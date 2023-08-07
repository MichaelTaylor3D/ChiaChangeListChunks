let config = {
  wallet_host: "https://localhost:9256",
  certificate_folder_path: "~/.chia/mainnet/config/ssl",
  default_wallet_id: 1,
  default_fee: 3000000,
  default_mirror_coin_amount: 300000000,
  maximum_rpc_payload_size: 26214400,
};

function configure(newConfig) {
  config = { ...config, ...newConfig };
}

async function chunkChangeList(storeId, changelist) {
  let result = [];
  let temp = [];
  let sizeCounter = 0;

  // Try to get existing keys or set to an empty array if fails
  const existingKeys = await getExistingKeys(storeId, config).catch(() => ({
    keys: [],
  }));

  for (const item of changelist) {
    const itemSize = item?.value?.length || JSON.stringify(item).length;

    if (itemSize > config.maximum_rpc_payload_size) {
      result = result.concat(
        await handleOversizedItem(
          item,
          itemSize,
          config.maximum_rpc_payload_size - 256,
          existingKeys
        )
      );
      sizeCounter = 0;
    } else if (sizeCounter + itemSize <= config.maximum_rpc_payload_size) {
      temp.push(item);
      sizeCounter += itemSize;
    } else {
      result.push(temp);
      temp = [item];
      sizeCounter = itemSize;
    }
  }

  if (temp.length > 0) result.push(temp);
  return result;
}

async function getExistingKeys(storeId, config) {
  return await callAndAwaitBlockchainRPC(
    `${config.datalayer_host}/get_keys`,
    {
      id: storeId,
    },
    config
  );
}

async function handleOversizedItem(item, itemSize, maxSize, existingKeys) {
  console.log(`Chunking item ${decodeHex(item.key)}`);
  const decodedKey = decodeHex(item.key, "hex");
  const chunkCount = Math.ceil(itemSize / maxSize);
  const multipartFileNames = [];
  const newChunks = [];

  const chunkKeys = Array.from(
    { length: chunkCount },
    (_, i) => `${decodedKey}.part${i + 1}`
  );
  const encodedChunkKeys = chunkKeys.map((key) => `0x${encodeHex(key)}`);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * maxSize;
    const chunk = item.value.substring(start, start + maxSize);

    const changeList = [];
    if (isExistingKey(encodedChunkKeys[i], existingKeys)) {
      console.log(`Updating existing key ${chunkKeys[i]}`);
      changeList.push({ action: "delete", key: encodedChunkKeys[i] });
    }

    changeList.push({
      key: encodedChunkKeys[i],
      action: "insert",
      value: chunk,
    });

    newChunks.push(changeList);
  }

  if (isExistingKey(`0x${encodeHex(decodedKey)}`, existingKeys)) {
    console.log(`Updating existing key ${decodedKey}`);
    multipartFileNames.push({ action: "delete", key: encodeHex(decodedKey) });
  }

  multipartFileNames.push({
    action: "insert",
    key: encodeHex(decodedKey),
    value: encodeHex(
      JSON.stringify({
        type: "multipart",
        parts: chunkKeys,
      })
    ),
  });

  newChunks.push(multipartFileNames);

  return newChunks;
}

function isExistingKey(encodedKey, existingKeys) {
  return existingKeys?.keys?.includes(encodedKey);
}

module.exports = {
  chunkChangeList,
  configure,
};
