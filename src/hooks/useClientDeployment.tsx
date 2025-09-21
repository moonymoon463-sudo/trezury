import { useState } from "react";
import { ethers } from "ethers";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useToast } from "@/hooks/use-toast";
import { DeploymentChain } from "@/types/lending";
import { contractDeploymentService } from "@/services/contractDeploymentService";

// Import contract bytecode and ABIs
import { ERC20_ABI, ERC20_BYTECODE } from "@/contracts/bytecode/ERC20TestToken";
import { LENDING_POOL_ABI, LENDING_POOL_BYTECODE } from "@/contracts/bytecode/LendingPool";

interface DeploymentProgress {
  stage: string;
  current: number;
  total: number;
  details: string;
}

export function useClientDeployment() {
  const { wallet } = useWalletConnection();
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState<DeploymentProgress | null>(null);

  const deployWithWallet = async (chain: DeploymentChain) => {
    if (!wallet.isConnected || !wallet.address) {
      toast({
        variant: "destructive",
        title: "Wallet Required",
        description: "Please connect your wallet first"
      });
      return false;
    }

    // Check if on correct network (Sepolia)
    if (wallet.chainId !== 11155111) {
      toast({
        variant: "destructive",
        title: "Wrong Network",
        description: "Please switch to Ethereum Sepolia testnet first"
      });
      return false;
    }

    // Check balance
    const minBalance = ethers.parseEther("0.1"); // Require at least 0.1 ETH
    const currentBalance = ethers.parseEther(wallet.balance || "0");
    
    if (currentBalance < minBalance) {
      toast({
        variant: "destructive",
        title: "Insufficient Balance",
        description: `Need at least 0.1 ETH for deployment. Current: ${wallet.balance} ETH. Get testnet ETH from https://sepoliafaucet.com/`
      });
      return false;
    }

    setIsDeploying(true);
    setProgress({ stage: "Initializing", current: 0, total: 6, details: "Connecting to wallet..." });

    try {
      // Get provider and signer from wallet
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      const initialSupply = ethers.parseUnits("1000000", 18);
      const contracts: Record<string, string> = {};

      // Deploy ERC20 tokens
      setProgress({ stage: "ERC20 Tokens", current: 1, total: 6, details: "Deploying USDC..." });
      const usdc = await deployContract(signer, "USDC Coin", "USDC", ERC20_BYTECODE, ERC20_ABI, ["USD Coin", "USDC", initialSupply]);
      contracts.USDC = await usdc.getAddress();

      setProgress({ stage: "ERC20 Tokens", current: 2, total: 6, details: "Deploying USDT..." });
      const usdt = await deployContract(signer, "USDT Coin", "USDT", ERC20_BYTECODE, ERC20_ABI, ["Tether USD", "USDT", initialSupply]);
      contracts.USDT = await usdt.getAddress();

      setProgress({ stage: "ERC20 Tokens", current: 3, total: 6, details: "Deploying DAI..." });
      const dai = await deployContract(signer, "DAI Coin", "DAI", ERC20_BYTECODE, ERC20_ABI, ["Dai Stablecoin", "DAI", initialSupply]);
      contracts.DAI = await dai.getAddress();

      setProgress({ stage: "ERC20 Tokens", current: 4, total: 6, details: "Deploying XAUT..." });
      const xaut = await deployContract(signer, "XAUT Coin", "XAUT", ERC20_BYTECODE, ERC20_ABI, ["Tether Gold", "XAUT", initialSupply]);
      contracts.XAUT = await xaut.getAddress();

      setProgress({ stage: "ERC20 Tokens", current: 5, total: 6, details: "Deploying AURU..." });
      const auru = await deployContract(signer, "AURU Token", "AURU", ERC20_BYTECODE, ERC20_ABI, ["AurusGOLD", "AURU", initialSupply]);
      contracts.AURU = await auru.getAddress();

      // Deploy LendingPool
      setProgress({ stage: "LendingPool", current: 6, total: 6, details: "Deploying LendingPool..." });
      const lendingPool = await deployContract(
        signer, 
        "LendingPool", 
        "LENDING",
        LENDING_POOL_BYTECODE, 
        LENDING_POOL_ABI, 
        [contracts.USDC, contracts.USDT, contracts.DAI, contracts.XAUT, contracts.AURU]
      );
      contracts.LendingPool = await lendingPool.getAddress();

      // Store contracts in backend
      await contractDeploymentService.storeContractAddresses(chain, {
        tokens: {
          usdc: contracts.USDC,
          usdt: contracts.USDT,
          dai: contracts.DAI,
          xaut: contracts.XAUT,
          auru: contracts.AURU,
        },
        lendingPool: contracts.LendingPool
      });

      toast({
        title: "Deployment Complete! 🎉",
        description: `All contracts deployed successfully using your wallet on ${chain}`
      });

      return true;
    } catch (error: any) {
      console.error('Client deployment failed:', error);
      
      let errorMessage = "Deployment failed";
      if (error.message.includes("insufficient funds")) {
        errorMessage = "Insufficient ETH for gas fees. Get more from https://sepoliafaucet.com/";
      } else if (error.message.includes("user rejected")) {
        errorMessage = "Transaction was cancelled by user";
      } else if (error.message.includes("gas")) {
        errorMessage = "Gas estimation failed. Please try again.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Deployment Failed",
        description: errorMessage
      });
      return false;
    } finally {
      setIsDeploying(false);
      setProgress(null);
    }
  };

  const deployContract = async (
    signer: ethers.Signer,
    name: string,
    symbol: string,
    bytecode: string,
    abi: any[],
    constructorArgs: any[]
  ) => {
    console.log(`Deploying ${name}...`);
    
    const factory = new ethers.ContractFactory(abi, bytecode, signer);
    
    // Estimate gas with buffer
    const deployTx = await factory.getDeployTransaction(...constructorArgs);
    const gasEstimate = await signer.estimateGas!(deployTx);
    const gasLimit = gasEstimate * 130n / 100n; // 30% buffer
    
    console.log(`Gas estimate for ${name}: ${gasEstimate.toString()}`);
    
    // Deploy with user confirmation
    const contract = await factory.deploy(...constructorArgs, {
      gasLimit
    });
    
    console.log(`${name} deployment tx: ${contract.deploymentTransaction()?.hash}`);
    
    // Wait for confirmation
    await contract.waitForDeployment();
    
    console.log(`${name} deployed at: ${await contract.getAddress()}`);
    return contract;
  };

  return {
    deployWithWallet,
    isDeploying,
    progress
  };
}