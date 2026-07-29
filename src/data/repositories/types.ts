export interface Repository<T extends { id: string }> {
  list(): T[];
  get(id: string): T | undefined;
  create(item: T): T;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): void;
}
