import { z } from 'zod';
import { validationFields } from './catalog-validation';
export function databaseErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let i = 0; i < 5 && current && typeof current === 'object'; i++) {
    if ('code' in current && typeof current.code === 'string') return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
}
export function publicApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const fields = validationFields(error);
    return {
      status: 422,
      body: {
        error: [...new Set(Object.values(fields))].join(' '),
        code: 'VALIDATION_ERROR',
        fieldErrors: fields,
      },
    };
  }
  const code = databaseErrorCode(error);
  const databaseMessages: Record<string, string> = {
    '23505': 'Dữ liệu bị trùng (ví dụ SKU hoặc tên đăng nhập). Vui lòng kiểm tra lại.',
    '23503': 'Dữ liệu liên quan không còn tồn tại. Tải lại danh mục và thử lại.',
    '23514': 'Giá hoặc tồn kho vi phạm điều kiện dữ liệu. Vui lòng kiểm tra lại.',
    '42P01':
      'Cơ sở dữ liệu chưa có bảng cần thiết. Khởi động lại server để chạy migrations tự động.',
    '42703': 'Cơ sở dữ liệu chưa cập nhật đủ cột. Khởi động lại server để chạy migrations tự động.',
    '28P01': 'Không thể đăng nhập cơ sở dữ liệu. Kiểm tra DATABASE_URL trên server.',
    ECONNREFUSED: 'Không kết nối được cơ sở dữ liệu. Kiểm tra địa chỉ và cổng kết nối.',
    ENETUNREACH:
      'Không có đường mạng tới cơ sở dữ liệu. Với Supabase Direct, kiểm tra kết nối IPv6.',
    ENOTFOUND: 'Không tìm thấy máy chủ cơ sở dữ liệu. Kiểm tra hostname trong DATABASE_URL.',
  };
  if (code)
    return {
      status: ['23505', '23503', '23514'].includes(code) ? 409 : 503,
      body: {
        error: databaseMessages[code] ?? 'Cơ sở dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại.',
        code: 'DATABASE_ERROR',
      },
    };
  if (error instanceof SyntaxError)
    return {
      status: 400,
      body: { error: 'Nội dung yêu cầu không đúng định dạng JSON.', code: 'INVALID_JSON' },
    };
  if (error instanceof Error && ('cause' in error || error.message.startsWith('Failed query:')))
    return {
      status: 503,
      body: {
        error: 'Không thể thực hiện truy vấn cơ sở dữ liệu. Vui lòng thử lại.',
        code: 'DATABASE_ERROR',
      },
    };
  const message =
    error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
  return {
    status: message.includes('quyền') ? 403 : message.includes('đăng nhập') ? 401 : 400,
    body: { error: message, code: 'REQUEST_ERROR' },
  };
}
