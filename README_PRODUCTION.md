Production deployment steps (Sepolia + Vercel + Render)
--------------------------------------------------

1) Create RPC provider (Alchemy recommended)
   - Sign up at https://alchemy.com and create an app on Sepolia. Copy the HTTPS RPC URL.

2) Prepare contract deployment keys
   - Use an account funded with ETH on Sepolia for deployment (MetaMask or private key).
   - NEVER commit private keys to the repo.

3) Deploy contracts to Sepolia
   - In `blockchain/.env` set `NETWORK=sepolia` and `RPC_URL` (or set env var on the CLI):

     ```powershell
     setx ALCHEMY_SEPOLIA_RPC "https://eth-sepolia.g.alchemy.com/v2/your_key"
     setx DEPLOYER_PRIVATE_KEY "0x..."
     npx hardhat run scripts/deploy-ssi.js --network sepolia
     ```

4) Configure Render (backend)
   - Create a new Web Service, connect your GitHub repo, choose Docker or Node environment.
   - Add the environment variables from `backend/.env.example` to Render's secrets.

5) Configure Vercel (frontend)
   - Import the repo, set `REACT_APP_API_BASE_URL` to your backend URL, set `REACT_APP_CHAIN_ID=11155111` and `REACT_APP_CONTRACT_ADDRESS` to deployed VotingSSI.

6) CI/CD
   - Update `.github/workflows/ci-cd.yml` with deploy steps for Vercel and Render or use their GitHub integrations.

7) Post-deploy
   - Verify contract addresses on Etherscan, test the admin flow and voting end-to-end.
   - Configure monitoring, backups, and rotate keys.
