/** User-facing guidance without parser internals or local paths. */
export function previewError(error: unknown, kind: string): string {
  const e = error as { name?: string; message?: string; code?: string } | null;
  const message = e?.message || String(error);
  if (e?.code === 'ENOENT') return '文件已移动或删除，请重新选择文件。';
  if (e?.code === 'EACCES' || e?.code === 'EPERM') return '没有权限读取文件，请检查文件权限或复制到可访问的目录后重试。';
  if (e?.name === 'PasswordException' || /password|encrypt/i.test(message))
    return `${kind}受密码保护，当前版本无法输入密码；请使用原软件另存为未加密副本后打开。`;
  if (e?.name === 'InvalidPDFException' || /invalid pdf|central directory|end of data|invalid zip|corrupt/i.test(message))
    return `${kind}结构损坏或下载不完整，请重新获取文件，或使用原软件检查后另存副本。`;
  return `无法打开${kind}，可能包含当前不支持的内容。请确认格式与扩展名一致，并尝试使用原软件另存为标准格式后打开。`;
}
