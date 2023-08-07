# Chia ChangeList Chunks

Chia ChangeList Chunks is a JavaScript module tailored to efficiently manage changelists exceeding the size limit for Chia DataLayer RPCs, which is 25 MB. When a changelist is processed through this module before being submitted to the DataLayer, it automatically partitions the changelist into multiple smaller ones if the original size exceeds the limit. Each of these smaller changelists can then be sent in separate transactions. However, if the original changelist size is within the permissible limit, it remains intact without any modification. Thus, the module ensures seamless transmission of data, regardless of the size of your changelist.

## Support the Project

If you found this tool helpful, consider donating to support the development of more Chia Datalayer Tools.

**Donation address:** `xch1es9faez5evlvdyfjdjth40fazfm3c9gptds0reuhryf30y3kl67qtcsc83`

Your support is greatly appreciated!

## Getting Started

First, install the module:

```bash
npm install chia-changelist-chunks
```

Then, import the module in your JavaScript file:

```javascript
const changeListChunker = require('chia-changelist-chunks');
```

## Configuration

The module comes with a default configuration:

```javascript
let config = {
  datalayer_host: "https://localhost:8562",
  wallet_host: "https://localhost:9256",
  certificate_folder_path: "~/.chia/mainnet/config/ssl",
  default_wallet_id: 1,
  default_fee: 3000000,
  default_mirror_coin_amount: 300000000,
  maximum_rpc_payload_size: 26214400,
};
```

You can override the default configuration using the `configure` function:

```javascript
changeListChunker.configure({
  wallet_host: "https://my.new-wallet-host.com",
  // other configuration options...
});
```

## API

The module provides the following functions:

### `chunkChangeList(changelist, storeId)`

This function takes in a change list and a store ID, and splits the change list into smaller chunks if any item size exceeds the maximum RPC payload size. The function returns a list of chunks.

```javascript
changeListChunker.chunkChangeList(storeId, changelist)
  .then(chunks => {
    // Process the chunks...
  });
```

### `configure(newConfig)`

This function allows you to provide a new configuration that overrides the default one:

```javascript
changeListChunker.configure({
  wallet_host: "https://my.new-wallet-host.com",
  // other configuration options...
});
```

Please note that the above is a simplified API documentation. For advanced usage and more details, please refer to the source code.

## handling oversized changes
In some cases, a single insert in the changelist might exceed RPC size limitation. Even if we create a changelist that holds just that key/value, it 
will still be rejected by the datalayer RPC. In this case, the tool will break up the value into a series of multipart key/value pairs.

Example:
file.mp4.part1
file.mp4.part2
...
file.mp4.part3

Whereas each multipart is in its own changelist that is under the size constraints.

Finally a final key will be added to the datalayer that is named as the original key:

Example: file.mp4

The value of this key is a JSON object in the following format
```
{
  type: "multipart",
  parts: [
    "file.mp4.part1",
    "file.mp4.part2"
    ...
    "file.mp4.part3"
  ]
}
```
When this key is consumed by an application, when you receive a value in this format, you can request each key and sticj their values together to reconstruct the original file.

## Contributions

Contributions to the project are welcome. Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.