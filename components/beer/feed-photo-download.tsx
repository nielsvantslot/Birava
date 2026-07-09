"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedPhotoDownloadProps {
  entryId: string;
  beerName: string | null;
}

export function FeedPhotoDownload({ entryId, beerName }: FeedPhotoDownloadProps) {
  const handleDownload = async () => {
    const response = await fetch(`/api/photos/${entryId}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${beerName ?? "beer"}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleDownload}
      title="Download photo"
    >
      <Download className="h-3.5 w-3.5" />
    </Button>
  );
}
