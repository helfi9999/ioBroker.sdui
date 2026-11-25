'use strict';

async function updateObjectName(adapter, id, existing, name) {
  if (!existing || existing.common?.name === name) {
    return false;
  }

  await adapter.extendObjectAsync(id, {
    common: {name}
  });

  return true;
}

module.exports = {updateObjectName};
