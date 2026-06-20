'use strict';

const Category = require('../models/Category');
const Article = require('../models/Article');
const { success, created, errors } = require('../utils/responseHelper');
const { generateSlug } = require('../utils/slugGenerator');
const { logAction } = require('../middleware/auditLogger');
const { cacheDelPattern } = require('../config/redis');

/**
 * GET /categories
 */
const getCategories = async (req, res, next) => {
  try {
    const { tree, parentId, active, includeCount } = req.query;

    if (tree === 'true') {
      const categories = await Category.getTree();
      return success(res, categories);
    }

    const filter = {};
    if (active !== undefined) filter.isActive = active === 'true';
    if (parentId === 'null' || parentId === '') {
      filter.parent = null;
    } else if (parentId) {
      filter.parent = parentId;
    }

    const categories = await Category.find(filter)
      .sort({ order: 1, name: 1 })
      .populate('parent', 'name slug')
      .lean();

    return success(res, categories);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /categories/:slug
 */
const getCategory = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const category = await Category.findOne({ slug }).lean();
    if (!category) return errors.notFound(res, 'التصنيف');

    const pageNum = parseInt(page);
    const limitNum = Math.min(50, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [articles, total] = await Promise.all([
      Article.find({
        $or: [{ category: category._id }, { subcategory: category._id }],
        status: 'published',
        isDeleted: { $ne: true },
      })
        .sort('-publishedAt')
        .skip(skip)
        .limit(limitNum)
        .populate('author', 'name avatar')
        .select('-content -revisions')
        .lean(),
      Article.countDocuments({
        $or: [{ category: category._id }, { subcategory: category._id }],
        status: 'published',
        isDeleted: { $ne: true },
      }),
    ]);

    const subcategories = await Category.find({ parent: category._id, isActive: true })
      .sort({ order: 1 })
      .lean();

    return success(res, {
      category,
      subcategories,
      articles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /categories
 */
const createCategory = async (req, res, next) => {
  try {
    const {
      name, nameEn, description, parent, order, icon, color,
      image, isActive, showInNav, showInHomepage, seoDefaults, layoutTemplate,
    } = req.body;

    // Generate slug
    let slug = req.body.slug;
    if (!slug) {
      slug = generateSlug(name);
    }
    slug = slug.toLowerCase().replace(/\s+/g, '-');

    // Check slug uniqueness
    const existing = await Category.findOne({ slug });
    if (existing) {
      return errors.conflict(res, 'هذا الرابط مستخدم بالفعل');
    }

    const category = await Category.create({
      name,
      nameEn,
      description,
      slug,
      parent: parent || null,
      order: order || 0,
      icon,
      color,
      image,
      isActive: isActive !== false,
      showInNav: showInNav !== false,
      showInHomepage: showInHomepage || false,
      seoDefaults: seoDefaults || {},
      layoutTemplate: layoutTemplate || 'default',
    });

    await logAction({
      req,
      action: 'category.create',
      resourceType: 'category',
      resourceId: category._id,
      resourceTitle: category.name,
    });

    await cacheDelPattern('homepage:*');

    return created(res, category, 'تم إنشاء التصنيف بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const category = await Category.findById(id);
    if (!category) return errors.notFound(res, 'التصنيف');

    // Prevent circular parent reference
    if (updates.parent && updates.parent.toString() === id) {
      return errors.badRequest(res, 'لا يمكن أن يكون التصنيف أبًا لنفسه');
    }

    // Check slug uniqueness if changed
    if (updates.slug && updates.slug !== category.slug) {
      const slugExists = await Category.findOne({ slug: updates.slug, _id: { $ne: id } });
      if (slugExists) return errors.conflict(res, 'هذا الرابط مستخدم بالفعل');
    }

    const allowedFields = [
      'name', 'nameEn', 'description', 'slug', 'parent', 'order', 'icon',
      'color', 'image', 'isActive', 'showInNav', 'showInHomepage', 'seoDefaults', 'layoutTemplate',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) category[field] = updates[field];
    });

    await category.save();

    await logAction({
      req,
      action: 'category.update',
      resourceType: 'category',
      resourceId: category._id,
      resourceTitle: category.name,
    });

    await cacheDelPattern('homepage:*');

    return success(res, category, 'تم تحديث التصنيف بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) return errors.notFound(res, 'التصنيف');

    // Check for articles
    const articleCount = await Article.countDocuments({ category: id, isDeleted: { $ne: true } });
    if (articleCount > 0) {
      return errors.badRequest(
        res,
        `لا يمكن حذف التصنيف لأنه يحتوي على ${articleCount} مقال`
      );
    }

    // Check for subcategories
    const subCount = await Category.countDocuments({ parent: id });
    if (subCount > 0) {
      return errors.badRequest(res, 'لا يمكن حذف تصنيف يحتوي على تصنيفات فرعية');
    }

    await Category.findByIdAndDelete(id);

    await logAction({
      req,
      action: 'category.delete',
      resourceType: 'category',
      resourceId: id,
      resourceTitle: category.name,
      severity: 'high',
    });

    await cacheDelPattern('homepage:*');

    return success(res, null, 'تم حذف التصنيف بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /categories/reorder
 * Reorder categories
 */
const reorderCategories = async (req, res, next) => {
  try {
    const { orders } = req.body;
    // orders: [{ id: '...', order: 1 }, ...]

    if (!Array.isArray(orders)) {
      return errors.badRequest(res, 'قائمة الترتيب مطلوبة');
    }

    const bulkOps = orders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order } },
      },
    }));

    await Category.bulkWrite(bulkOps);
    await cacheDelPattern('homepage:*');

    return success(res, null, 'تم تحديث الترتيب بنجاح');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /categories/nav
 * Get navigation categories (public)
 */
const getNavCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true, showInNav: true, parent: null })
      .sort({ order: 1 })
      .select('name nameEn slug color icon order')
      .lean();

    return success(res, categories);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  getNavCategories,
};
