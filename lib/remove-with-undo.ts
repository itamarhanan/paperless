import { toast } from "sonner";
import { deleteDocument, restoreDocument } from "@/lib/storage";

/** Removes a book and offers Undo in a toast; true when something was removed. */
export async function removeWithUndo(id: string): Promise<boolean> {
  const deleted = await deleteDocument(id);
  if (deleted) {
    toast(`Removed “${deleted.saved.title}”`, {
      action: { label: "Undo", onClick: () => void restoreDocument(deleted) },
    });
    return true;
  }
  return false;
}
