export async function runLiveScanCycle<T>(
  recognize: () => Promise<T>,
  isActive: () => boolean,
  recognizedIds: (result: T) => string[],
  save: (result: T, ids: string[]) => Promise<void>,
) {
  const result = await recognize();
  if (!isActive()) return;
  const ids = [...new Set(recognizedIds(result))];
  if (ids.length) await save(result, ids);
}