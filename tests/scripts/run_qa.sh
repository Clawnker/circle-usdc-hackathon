#!/bin/bash

API_KEY="demo-key-12345"
BASE_URL="https://circle-usdc-hackathon.onrender.com"

queries=(
  "What is the current price of Bitcoin?"
  "Analyze security risks of Uniswap v4"
  "Compare social sentiment for Ethereum with its token price"
  "Solana DeFi ecosystem overview"
  "Technical summary of the x402 payment protocol used by Hivemind"
  "Crypto regulation sentiment analysis"
  "Ethereum price and market analysis"
  "Audit security of 0x1200ce87F23Cb13E23532fc05d5D9a4dC8826B07"
  "Top trending DeFi protocols right now?"
  "How does the Hivemind Protocol agent marketplace work?"
)

results_file="qa_results.json"
echo "[" > $results_file

for i in "${!queries[@]}"; do
  query="${queries[$i]}"
  echo "Running query $((i+1)): $query"
  
  # Dispatch task
  response=$(curl -s -X POST "$BASE_URL/dispatch" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"prompt\": \"$query\"}")
  
  taskId=$(echo $response | grep -oP '(?<="taskId":")[^"]*')
  
  if [ -z "$taskId" ]; then
    echo "Failed to get taskId for query $((i+1))"
    echo "{\"query\": \"$query\", \"error\": \"Failed to dispatch\"}" >> $results_file
  else
    echo "TaskId: $taskId. Waiting for completion..."
    
    # Poll status
    status="pending"
    while [[ "$status" == "pending" || "$status" == "processing" || "$status" == "routing" || "$status" == "awaiting_payment" ]]; do
      sleep 2
      task_response=$(curl -s -X GET "$BASE_URL/status/$taskId" \
        -H "X-API-Key: $API_KEY")
      status=$(echo $task_response | grep -oP '(?<="status":")[^"]*')
    done
    
    echo "Status: $status"
    echo "$task_response" >> $results_file
  fi
  
  if [ $i -lt $((${#queries[@]} - 1)) ]; then
    echo "," >> $results_file
  fi
done

echo "]" >> $results_file
echo "QA finished. Results saved to $results_file"
