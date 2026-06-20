import { redirect } from 'next/navigation';

// Legacy /opinion URL — redirect to the fikr (thought) section
export default function OpinionPage() {
  redirect('/category/fikr');
}
