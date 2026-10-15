"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LibraryRepository } from "@/repositories/library-repository";

const LibraryRepositoryContext = createContext<LibraryRepository | null>(null);

export function LibraryRepositoryProvider({
  repository,
  children,
}: {
  repository: LibraryRepository;
  children: ReactNode;
}) {
  return (
    <LibraryRepositoryContext.Provider value={repository}>
      {children}
    </LibraryRepositoryContext.Provider>
  );
}

export function useLibraryRepository(): LibraryRepository {
  const repository = useContext(LibraryRepositoryContext);
  if (!repository) {
    throw new Error(
      "useLibraryRepository must be used within LibraryRepositoryProvider",
    );
  }
  return repository;
}
