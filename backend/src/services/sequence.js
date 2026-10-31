export async function nextNumber(tx, name, prefix) {
  const sequence = await tx.sequence.upsert({
    where: { name },
    update: { value: { increment: 1 } },
    create: { name, value: 1 },
  });
  return `${prefix}-${String(sequence.value).padStart(6, '0')}`;
}