import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productFormSchema, parseVnd, editorFieldErrors } from '../src/lib/catalog-validation';
import { publicApiError } from '../src/lib/api-errors';

test('invalid product returns actionable field errors including nested price and images', () => {
  const result = productFormSchema.safeParse({
    name: ' a ',
    material: ' ',
    description: 'ngắn',
    categoryId: '',
    images: [],
    active: true,
    featured: false,
    initialVariants: [{ color: '', size: 'M', price: 0, stock: -1 }],
  });
  assert.equal(result.success, false);
  if (result.success) return;
  const response = publicApiError(result.error);
  assert.equal(response.status, 422);
  const fields = editorFieldErrors(
    'fieldErrors' in response.body ? response.body.fieldErrors! : {},
  );
  for (const key of [
    'name',
    'description',
    'material',
    'categoryId',
    'images',
    'price',
    'stock',
    'color',
  ])
    assert.ok(fields[key], key);
  assert.match(fields.description, /10 ký tự/);
});
test('VND formatted input accepts thousands but rejects decimal and empty values', () => {
  for (const input of ['350000', '350.000', '350,000', '350 000'])
    assert.equal(parseVnd(input), 350000);
  for (const input of ['', '35.5', '-1000', 'abc']) assert.ok(Number.isNaN(parseVnd(input)));
});
test('database errors do not expose SQL or parameters', () => {
  const error = new Error('Failed query: INSERT secret-password', {
    cause: Object.assign(new Error('private detail'), { code: '23503' }),
  });
  const result = publicApiError(error);
  assert.equal(result.status, 409);
  assert.ok(!JSON.stringify(result).includes('secret-password'));
  assert.match(result.body.error, /danh mục/);
});
