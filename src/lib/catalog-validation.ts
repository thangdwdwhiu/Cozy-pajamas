import { z } from 'zod';

export function productSchema(imageAllowed: (url: string) => boolean = () => true) {
  return z
    .object({
      id: z.string().optional(),
      name: z
        .string({ error: 'Vui lòng nhập tên sản phẩm.' })
        .trim()
        .min(3, 'Tên sản phẩm cần ít nhất 3 ký tự (không tính khoảng trắng đầu/cuối).')
        .max(150, 'Tên sản phẩm tối đa 150 ký tự.'),
      categoryId: z
        .string({ error: 'Vui lòng chọn danh mục sản phẩm.' })
        .trim()
        .min(1, 'Vui lòng chọn danh mục sản phẩm.'),
      description: z
        .string({ error: 'Vui lòng nhập mô tả sản phẩm.' })
        .trim()
        .min(10, 'Mô tả sản phẩm cần ít nhất 10 ký tự (không tính khoảng trắng đầu/cuối).')
        .max(4000, 'Mô tả sản phẩm tối đa 4.000 ký tự.'),
      material: z
        .string({ error: 'Vui lòng nhập chất liệu.' })
        .trim()
        .min(2, 'Chất liệu cần ít nhất 2 ký tự.')
        .max(100, 'Chất liệu tối đa 100 ký tự.'),
      images: z
        .array(
          z
            .string()
            .min(1, 'Ảnh chưa tải xong. Vui lòng tải lại ảnh.')
            .refine(
              imageAllowed,
              'Ảnh không thuộc kho ảnh đã cấu hình. Vui lòng tải lại ảnh hoặc kiểm tra SUPABASE_URL và SUPABASE_STORAGE_BUCKET.',
            ),
          { error: 'Vui lòng tải ảnh sản phẩm.' },
        )
        .min(1, 'Vui lòng tải ít nhất một ảnh sản phẩm.')
        .max(10, 'Một sản phẩm có tối đa 10 ảnh.'),
      active: z.boolean({ error: 'Trạng thái hiển thị sản phẩm không hợp lệ.' }),
      featured: z.boolean({ error: 'Trạng thái nổi bật không hợp lệ.' }),
      initialVariants: z
        .array(
          z.object({
            color: z
              .string({ error: 'Vui lòng nhập màu sắc.' })
              .trim()
              .min(1, 'Vui lòng nhập màu sắc.')
              .max(50, 'Tên màu sắc tối đa 50 ký tự.'),
            size: z
              .string()
              .trim()
              .min(1, 'Vui lòng chọn kích thước.')
              .max(10, 'Kích thước tối đa 10 ký tự.'),
            price: z
              .number({ error: 'Giá bán phải là số tiền VND hợp lệ, ví dụ 350000 hoặc 350.000.' })
              .int('Giá bán phải là số nguyên đồng.')
              .min(1000, 'Giá bán phải từ 1.000đ.')
              .max(100000000, 'Giá bán không được vượt quá 100.000.000đ.'),
            stock: z
              .number({ error: 'Tồn kho phải là số nguyên từ 0 trở lên.' })
              .int('Tồn kho phải là số nguyên, không có phần thập phân.')
              .min(0, 'Tồn kho không được âm.')
              .max(100000, 'Tồn kho mỗi kích thước tối đa 100.000.'),
          }),
        )
        .max(50, 'Tối đa 50 phân loại sản phẩm.')
        .optional(),
    })
    .superRefine((value, ctx) => {
      if (!value.id && !value.initialVariants?.length)
        ctx.addIssue({
          code: 'custom',
          path: ['initialVariants'],
          message: 'Chọn ít nhất một kích thước và điền giá bán, màu sắc.',
        });
    });
}
export const productFormSchema = productSchema();
export const categorySchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(2, 'Tên danh mục cần ít nhất 2 ký tự.')
    .max(100, 'Tên danh mục tối đa 100 ký tự.'),
});
export function parseVnd(value: string) {
  const cleaned = value.trim();
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  if (/^\d{1,3}([., ]\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/[., ]/g, ''));
  return Number.NaN;
}
export type FieldErrors = Record<string, string>;
export function validationFields(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
export function editorFieldErrors(fields: FieldErrors) {
  const result: FieldErrors = {};
  for (const [path, message] of Object.entries(fields)) {
    const key = path.startsWith('initialVariants.')
      ? path.split('.').at(-1)!
      : path.startsWith('images.')
        ? 'images'
        : path === 'initialVariants'
          ? 'sizes'
          : path;
    result[key] ??= message;
  }
  return result;
}
