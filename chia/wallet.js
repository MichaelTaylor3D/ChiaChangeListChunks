const superagent = require("superagent");
const https = require("https");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { getChiaRoot } = require("./chia-root");

const getBaseOptions = (config) => {
  const chiaRoot = getChiaRoot();
  let cert, key;

  if (process.env.CHIA_CERT_BASE64 && process.env.CHIA_KEY_BASE64) {
    console.log(`Using cert and key from environment variables.`);

    cert = Buffer.from(process.env.CHIA_CERT_BASE64, "base64").toString(
      "ascii"
    );
    key = Buffer.from(process.env.CHIA_KEY_BASE64, "base64").toString("ascii");
  } else {
    let certificateFolderPath =
      config.certificate_folder_path || `${chiaRoot}/config/ssl`;

    // If certificateFolderPath starts with "~", replace it with the home directory
    if (certificateFolderPath.startsWith("~")) {
      certificateFolderPath = path.join(
        os.homedir(),
        certificateFolderPath.slice(1)
      );
    }

    const certFile = path.resolve(
      `${certificateFolderPath}/data_layer/private_data_layer.crt`
    );
    const keyFile = path.resolve(
      `${certificateFolderPath}/data_layer/private_data_layer.key`
    );

    cert = fs.readFileSync(certFile);
    key = fs.readFileSync(keyFile);
  }

  const baseOptions = {
    method: "POST",
    cert,
    key,
    timeout: 300000,
  };

  return baseOptions;
};

const walletIsSynced = async (config) => {
  try {
    const { cert, key, timeout } = getBaseOptions(config);

    const response = await superagent
      .post(`${config.wallet_host}/get_sync_status`)
      .send({})
      .key(key)
      .cert(cert)
      .timeout(timeout)
      .agent(new https.Agent({ rejectUnauthorized: false }));

    const data = JSON.parse(response.text);

    if (data.success) {
      return data.synced;
    }

    return false;
  } catch (error) {
    return false;
  }
};

const walletIsAvailable = async (config) => {
  return await walletIsSynced(config);
};

const waitForAllTransactionsToConfirm = async (config) => {
  const unconfirmedTransactions = await hasUnconfirmedTransactions(config);
  
  if (unconfirmedTransactions) {
    await new Promise((resolve) => setTimeout(() => resolve(), 15000));
    return waitForAllTransactionsToConfirm(config);
  }

  return true;
};

const hasUnconfirmedTransactions = async (config, options) => {
  const { cert, key, timeout } = getBaseOptions(config);

  const response = await superagent
    .post(`${config.wallet_host}/get_transactions`)
    .send({
      wallet_id: options?.walletId || config.default_wallet_id,
      sort_key: "RELEVANCE",
    })
    .key(key)
    .cert(cert)
    .timeout(timeout)
    .agent(new https.Agent({ rejectUnauthorized: false }));

  const data = JSON.parse(response.text);

  if (data.success) {
    const unconfirmedTransactions = data.transactions.some(
      (transaction) => !transaction.confirmed
    );

    if (unconfirmedTransactions) {
      console.log("Wallet has pending transactions");
    }

    return unconfirmedTransactions;
  }

  return false;
};



module.exports = {
  getBaseOptions,
  hasUnconfirmedTransactions,
  walletIsSynced,
  walletIsAvailable,
  waitForAllTransactionsToConfirm
};
