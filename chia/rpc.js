const superagent = require("superagent");
const wallet = require("./wallet");
const https = require("https");

const callAndAwaitBlockchainRPC = async (url, params, config, maxAttempts = 10) => {
  const { cert, key } = wallet.getBaseOptions(config);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await wallet.walletIsSynced(config);
    await wallet.waitForAllTransactionsToConfirm(config);

    const body = {
      ...params,
    };

    console.log(
      `Calling Chia RPC... ${JSON.stringify({
        url,
      })}`
    );

    try {
      const response = await superagent
        .post(url)
        .send(body)
        .set("Content-Type", "application/json")
        .key(key)
        .cert(cert)
        .agent(new https.Agent({ rejectUnauthorized: false }));

      if (!response.body.success) {
        if (
          response.body.error ===
          "Changelist resulted in no change to tree data"
        ) {
          return { success: true, message: response.body.error };
        }

        if (response.body.error.includes("non-hexadecimal number")) {
          console.log(params);
        }

        throw new Error(
          `FAILED: Calling Chia RPC: ${url} ${JSON.stringify(response.body)}}}`
        );
      }

      return response.body;
    } catch (error) {
      console.log(error.message);

      if (attempt + 1 < maxAttempts) {
        console.error("Retrying...");
      } else {
        return { success: false, error: error.message };
      }
    }
  }
};

module.exports = {
  callAndAwaitBlockchainRPC
}
