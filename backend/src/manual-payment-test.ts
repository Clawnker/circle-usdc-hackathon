
import { createWalletClient, http, publicActions, parseUnits, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// Config
const AGENT_URL = 'https://x402.minara.ai/x402/chat';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const PROMPT = 'Where is the deepest liquidity for the clawnch token on Base?';

async function run() {
  const account = privateKeyToAccount(process.env.DEMO_WALLET_PRIVATE_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('https://sepolia.base.org')
  }).extend(publicActions);

  console.log(`Wallet: ${account.address}`);

  // 1. Initial Request
  console.log(`\n1. Sending initial request to ${AGENT_URL}...`);
  try {
    await axios.post(AGENT_URL, { prompt: PROMPT });
    console.log("Unexpected success (no payment required?)");
  } catch (err: any) {
    if (err.response?.status === 402) {
      console.log("Got 402 Payment Required");
      const header = err.response.headers['payment-required']; // or x-payment-required?
      // Axios lowercases headers
      const authHeader = err.response.headers['www-authenticate'] || err.response.headers['payment-required'];
      
      console.log("Header:", authHeader);
      
      // Parse header manually since it might be base64 or custom
      // x402 standard: "x402 amount=... asset=... payTo=..." or base64 JSON
      // Silverback likely returns base64 JSON in payment-required header
      
      // Let's decode if base64
      let paymentInfo;
      try {
        const decoded = Buffer.from(authHeader, 'base64').toString();
        paymentInfo = JSON.parse(decoded);
        console.log("Decoded Payment Info:", paymentInfo);
      } catch {
        console.log("Could not decode header as base64 JSON");
        return;
      }

      // 2. Pay
      const amount = paymentInfo.accepts[0].amount; // e.g. "100000" (0.10 USDC)
      const recipient = paymentInfo.accepts[0].payTo;
      
      console.log(`\n2. Paying ${amount} units to ${recipient}...`);
      
      const hash = await client.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, BigInt(amount)],
        chain: baseSepolia,
        account
      });
      
      console.log(`Tx Hash: ${hash}`);
      console.log("Waiting for confirmation...");
      await client.waitForTransactionReceipt({ hash });
      console.log("Confirmed!");

      // 3. Retry with proof
      console.log(`\n3. Retrying with proof...`);
      try {
        const res = await axios.post(AGENT_URL, { prompt: PROMPT }, {
          headers: {
            'X-Payment-Proof': hash,
            'Content-Type': 'application/json'
          }
        });
        console.log("\n✅ SUCCESS!");
        console.log("Response:", JSON.stringify(res.data, null, 2));
      } catch (err2: any) {
        console.error("Retry failed:", err2.response?.status, err2.response?.data);
      }

    } else {
      console.error("Request failed:", err.message);
    }
  }
}

run().catch(console.error);
