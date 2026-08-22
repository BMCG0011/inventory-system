import { type ColumnDef, type Table, flexRender } from "@tanstack/react-table";
import { TableCell, TableRow } from "@/components/ui/table";

interface DataRowsProps<TData, TValue> {
  table: Table<TData>;
  columns: ColumnDef<TData, TValue>[];
}

export function DataRows<TData, TValue>({
  table,
}: DataRowsProps<TData, TValue>) {
  const rows = table.getRowModel().rows;

  return (
    <>
      {rows.length ? (
        rows.map((row) => (
          <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell
            colSpan={table.getAllColumns().length}
            className="text-center"
          >
            No results.
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
