// สั่ง ROLLBACK ธุรกรรมฐานข้อมูลอย่างปลอดภัยโดยไม่โยนข้อผิดพลาดซ้ำซ้อน
export async function safeRollback(client: { query: (text: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch (error) {
    console.error('ROLLBACK failed:', error);
  }
}
