/** Clear local file picks after photos are stored on the server. */
export function afterDispatchRowSaved(rowId, setSavedIds, setRows, persistedRef) {
  if (persistedRef?.current) {
    persistedRef.current.add(rowId);
  }
  setSavedIds((prev) => new Set(prev).add(rowId));
  setRows((prev) =>
    prev.map((r) =>
      r.id === rowId
        ? {
            ...r,
            _frontPhoto: null,
            _backPhoto: null,
            _rightPhoto: null,
            _leftPhoto: null,
          }
        : r,
    ),
  );
}

export function shouldSkipDispatchUploadForRow(
  row,
  initialSerialNos,
  savedIds,
  persistedRef,
) {
  return (
    initialSerialNos.has(row.id) ||
    savedIds.has(row.id) ||
    (persistedRef?.current?.has(row.id) ?? false)
  );
}

export function normalizeDispatchPhotoUrls(prevPhotos, photoUrls, stockAlreadyDeducted) {
  if (!photoUrls.length) {
    return prevPhotos;
  }
  if (stockAlreadyDeducted) {
    return photoUrls.join(",");
  }
  if (prevPhotos && photoUrls.length < 4) {
    return `${prevPhotos},${photoUrls.join(",")}`;
  }
  return photoUrls.join(",");
}
