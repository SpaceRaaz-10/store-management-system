import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, total, onPage }: Props) {
  if (totalPages <= 1) {
    return <div className="text-xs text-muted-foreground">{total} item(s)</div>;
  }
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {total} item(s)
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}