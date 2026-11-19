import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/quartz/ui/dialog";
import { Content, type ContentNode } from "./content";
import downloadContent from "./download-content.json";
import type { Release } from "./releases";

export function DownloadDialog({ open, onOpenChange, release }: { open: boolean; onOpenChange: (open: boolean) => void; release?: Release }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>All downloads</DialogTitle>
        <DialogDescription>Choose your platform and architecture. {release?.tag_name ?? "Get the latest release."}</DialogDescription>
      </DialogHeader>
      <DialogBody><div className="reading download-copy"><Content nodes={downloadContent as ContentNode[]} release={release} /></div></DialogBody>
    </DialogContent>
  </Dialog>;
}
