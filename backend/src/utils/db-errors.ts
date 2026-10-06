// แปลง error ของ PostgreSQL เป็นคำตอบ HTTP ที่เหมาะสม แทนการตอบ 500 กับข้อผิดพลาดที่เกิดจากข้อมูลของผู้ใช้
export interface DbErrorResponse {
  status: number;
  message: string;
}

export function mapDbError(error: unknown): DbErrorResponse | null {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return { status: 409, message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว' };
  if (code === '23503') return { status: 400, message: 'ไม่สามารถดำเนินการได้ เนื่องจากมีข้อมูลที่เกี่ยวข้องอยู่' };
  if (code === '23502' || code === '23514') return { status: 400, message: 'ข้อมูลไม่ครบหรือไม่ถูกต้องตามเงื่อนไขของระบบ' };
  if (code === '22P02' || code === '22003') return { status: 400, message: 'รูปแบบข้อมูลไม่ถูกต้อง' };
  return null;
}
