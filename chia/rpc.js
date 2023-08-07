const superagent = require("superagent");
const wallet = require("./wallet");
const https = require("https");

const convertXchToMojos = (xch) => {
  return Math.round(xch * 1000000000000);
};

const getFeeEstimate = async (config) => {
  try {
    const { cert, key } = wallet.getBaseOptions(config);

    if (!config.full_node_host) {
      return config.default_fee;
    }

    const response = await superagent
      .post(`${config.full_node_host}}/get_fee_estimate`)
      .send({
        target_times: [60, 120, 300],
        spend_type: "send_xch_transaction",
      })
      .set("Content-Type", "application/json")
      .key(key)
      .cert(cert)
      .agent(
        new https.Agent({
          rejectUnauthorized: false,
        })
      );

    let mojos;

    if (
      response?.body?.estimates === undefined ||
      response?.body?.estimates[0] === undefined
    ) {
      mojos = config.default_fee;
    } else {
      mojos = response?.body?.estimates?.[0];
    }

    // if the mojos are over 1 trillion, assume there is something wrong with the response
    // and return the default fee
    if (mojos > convertXchToMojos(1)) {
      console.log(`Current fee estimate is too high: ${mojos} mojos`);
      return config.default_fee;
    } else {
      console.log(`Current fee estimate: ${mojos} mojos`);
      return mojos || config.default_fee;
    }
  } catch {
    return config.default_fee;
  }
};

const callAndAwaitBlockchainRPC = async (url, params, config, maxAttempts = 10) => {
  const { cert, key } = wallet.getBaseOptions(config);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await wallet.walletIsSynced(config);
    await wallet.waitForAllTransactionsToConfirm(config);

    const feeEstimate = await getFeeEstimate();
    const body = {
      ...params,
      fee: feeEstimate || 300000000,
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
