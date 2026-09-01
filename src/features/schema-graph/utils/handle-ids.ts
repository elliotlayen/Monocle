const HANDLE_SEPARATOR = "|";

const encodePart = (value: string) => encodeURIComponent(value);
const decodePart = (value: string) => decodeURIComponent(value);

export const buildNodeHandleBase = (nodeId: string) => encodePart(nodeId);

export const buildColumnHandleBase = (nodeId: string, columnName: string) =>
  `${encodePart(nodeId)}${HANDLE_SEPARATOR}${encodePart(columnName)}`;

// Strip at most ONE direction suffix: a column literally named "foo-target"
// yields the handle "...foo-target-source", and chained stripping would
// mangle it down to "foo".
export const stripHandleSuffix = (handleId: string) =>
  handleId.replace(/-(source|target)$/, "");

export const parseHandleBase = (handleBase: string) => {
  const separatorIndex = handleBase.indexOf(HANDLE_SEPARATOR);
  if (separatorIndex === -1) {
    return { nodeId: decodePart(handleBase), columnName: "" };
  }

  return {
    nodeId: decodePart(handleBase.slice(0, separatorIndex)),
    columnName: decodePart(handleBase.slice(separatorIndex + 1)),
  };
};
