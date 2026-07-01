"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AddBeerDialog } from "@/components/beer/add-beer-dialog";

export function AddBeerFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-2xl shadow-orange-500/40"
        aria-label="Add beer"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key="plus"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </motion.div>
        </AnimatePresence>
      </motion.button>

      <AddBeerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
