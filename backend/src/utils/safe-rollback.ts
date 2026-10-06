// ทำ ROLLBACK โดยไม่ให้ error ของ ROLLBACK ทำให้ request ค้างหรือกลายเป็น unhandled rejection
export async function safeRollback(client: { query: (text: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch (error) {
    console.error('ROLLBACK failed:', error);
  }
}
