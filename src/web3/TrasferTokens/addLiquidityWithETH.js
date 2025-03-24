require('dotenv').config();
const { ethers } = require('ethers');
const IUniswapV2RouterABI = require('./IUniswapV2RouterAbi.json');
const v2UniswapFactoryAbi = require('./v2UniswapFactoryAbi.json');
// Setup provider & wallet
const WALLET_SECRET = process.env.WALLET_SECRET.toString();
const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL_SEPOLIA);
const wallet = new ethers.Wallet(WALLET_SECRET, provider);

// Uniswap V2 Router Address (Sepolia)
const UNISWAP_V2_ROUTER_ADDRESS = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";





// ERC20 Token ABI (basic approve)
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_from",
                "type": "address"
            },
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "balance",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            },
            {
                "name": "_spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "payable": true,
        "stateMutability": "payable",
        "type": "fallback"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    }
]




// Liquidity amounts (adjust these)
const AMOUNT_TOKEN = ethers.parseUnits("204831000", 18);  // 100 Token (adjust decimals if needed)

const AMOUNT_ETH = ethers.parseEther("5.110905757186139255");        // 0.1 ETH

// Add liquidity function
const addLiquidityWithETH = async (TOKEN_ADDRESS) => {

    try {
        const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, IUniswapV2RouterABI, wallet);

        const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);
        // console.log("router",router)
        // console.log("token",token)
        // Approve Router to spend Token
        console.log("Approving token...", wallet?.address);
        console.log("Approving token...", await provider.getBalance(wallet?.address));
        console.log("Approving token...", await token.balanceOf(wallet?.address));
        console.log("Approving token...");
        const approveTx = await token.approve(UNISWAP_V2_ROUTER_ADDRESS, AMOUNT_TOKEN);
        await approveTx.wait();
        console.log("Token approved");

        // // Add Liquidity
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now


        console.log("Adding liquidity with ETH...");
        // Set slippage tolerance (1% slippage)
        const amountTokenMin = AMOUNT_TOKEN * 99n / 100n;  // BigInt math (ethers v6)
        const amountETHMin = AMOUNT_ETH * 99n / 100n;      // BigInt math (ethers v6)

        // Add Liquidity
        console.log("Adding liquidity with ETH...");
        const tx = await router.addLiquidityETH(
            TOKEN_ADDRESS,
            AMOUNT_TOKEN,
            amountTokenMin,     // Min token amount after slippage
            amountETHMin,       // Min ETH amount after slippage
            wallet.address,
            deadline,
            { value: AMOUNT_ETH }  // This sends ETH to the router
        );

        const receipt = await tx.wait();
        console.log("receipt", receipt)
        if (receipt.status === 0) {
            throw new Error(`Transaction failed: ${tx.hash}`);
        }

        const response = await fetchLiquidityPoolAddress(router, TOKEN_ADDRESS);

        if (!response.address) {
            throw new Error(` Liquidity Pool Address not found: ${response.error || "Unknown error"}`);
        }

        return {
            address: response.address,
            tx: tx.hash,
            success: true
        }



    } catch (error) {

        console.log("error while adding liquidity with eth", error);
        return {
            address: null,
            tx: null,
            success: false
        }




    }
}




const fetchLiquidityPoolAddress = async (router, TOKEN_ADDRESS) => {
    try {

        //fetch v2_uni_swap_factory address
        const V2_UNISWAP_FACTORY_ADDRESS = await router.factory();
        console.log("V2_UNISWAP_FACTORY_ADDRESS", V2_UNISWAP_FACTORY_ADDRESS);
        //fetch weth address 
        const wethAddress = await router.WETH();
        console.log("wehtAddress", wethAddress);

        //initialize factory contract 
        const uniSwapFactory = new ethers.Contract(V2_UNISWAP_FACTORY_ADDRESS, v2UniswapFactoryAbi, wallet);
        console.log("uniSwapFactory", uniSwapFactory);

        //fetch pool address by giving weth and token address to the factory uniswap v2 address
        const liquidityPoolAddress = await uniSwapFactory.getPair(wethAddress, TOKEN_ADDRESS);
        console.log("liquidityPoolAddress", liquidityPoolAddress);

        if (liquidityPoolAddress === "0x0000000000000000000000000000000000000000") {
            throw new Error("Liquidity pool does not exist for the given pair.");
        }

        // return the liquidity pool address
        return {
            address: liquidityPoolAddress,
        }

    } catch (error) {
        console.error("error fetching liquidity address", error);
        return {
            address: null,
        }
    }
}

// const checkthisshit = async ( TOKEN_ADDRESS) => {
//     try {
//         const router = new ethers.Contract(UNISWAP_V2_ROUTER_ADDRESS, IUniswapV2RouterABI, wallet);
//         console.log("router",router)
//         //fetch v2_uni_swap_factory address
//         const V2_UNISWAP_FACTORY_ADDRESS = await router.factory();
//         console.log("V2_UNISWAP_FACTORY_ADDRESS", V2_UNISWAP_FACTORY_ADDRESS);
//         // //fetch weth address 
//         const wethAddress = await router.WETH();
//         console.log("wehtAddress", wethAddress);

//         // //initialize factory contract 
//         const uniSwapFactory = new ethers.Contract(V2_UNISWAP_FACTORY_ADDRESS, v2UniswapFactoryAbi, wallet);


//         // //fetch pool address by giving weth and token address to the factory uniswap v2 address
//         const liquidityPoolAddress = await uniSwapFactory.getPair(wethAddress, TOKEN_ADDRESS);
//         console.log("liquidityPoolAddress", liquidityPoolAddress);

//         if (liquidityPoolAddress === "0x0000000000000000000000000000000000000000") {
//             throw new Error("Liquidity pool does not exist for the given pair.");
//         }

//         // // return the liquidity pool address
//         return {
//             address: liquidityPoolAddress,
//         }

//     } catch (error) {
//         console.error("error fetching liquidity address", error);
//         return {
//             address: null,
//         }
//     }
// }

module.exports = { addLiquidityWithETH, fetchLiquidityPoolAddress }