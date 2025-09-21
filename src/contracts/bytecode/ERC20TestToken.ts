// Simple ERC20 Test Token - Valid compiled bytecode
export const ERC20_BYTECODE = "0x608060405234801561001057600080fd5b50604051610521380380610521833981016040819052610030916100db565b600361003c848261017a565b50600461004983826101aa565b506005805460ff191660ff84161790556100633382610069565b5061026a565b6001600160a01b0382166100c35760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015260640160405180910390fd5b80600260008282546100d59190610239565b90915550505050565b600080600080608085870312156100f457600080fd5b84516001600160401b0381111561010a57600080fd5b8501601f8101871361011b57600080fd5b805161012681610252565b60405161013382826101c8565b81815260200183018660005b8381101561015557815184529282019201610145565b505050506020860151604087015160608801519598509396509194509250905056fe608060405234801561001057600080fd5b50600436106100885760003560e01c8063313ce5671161005b578063313ce567146100fd57806370a082311461010c57806395d89b411461013f578063a9059cbb1461014757600080fd5b806306fdde031461008d578063095ea7b3146100ab57806318160ddd146100ce57806323b872dd146100e0575b600080fd5b61009561015a565b6040516100a2919061019b565b60405180910390f35b6100be6100b93660046101e4565b6101ec565b60405190151581526020016100a2565b6002545b6040519081526020016100a2565b6100be6100ee36600461020e565b6001600160a01b031660009081526020819052604090205490565b60055460ff165b60405160ff90911681526020016100a2565b6100956101ff565b6100be6101553660046101e4565b61020e565b6060600380546101699061024a565b80601f01602080910402602001604051908101604052809291908181526020018280546101959061024a565b80156101e25780601f106101b7576101008083540402835291602001916101e2565b820191906000526020600020905b8154815290600101906020018083116101c557829003601f168201915b505050505090505b90565b60006101f9338484610221565b92915050565b6060600480546101699061024a565b60006101f9338484610345565b6001600160a01b0383166102835760405162461bcd60e51b815260206004820152602560248201527f45524332303a20617070726f76652066726f6d20746865207a65726f206164646044820152643937b9b99760d91b60648201526084015b60405180910390fd5b6001600160a01b0382166102e45760405162461bcd60e51b815260206004820152602360248201527f45524332303a20617070726f766520746f20746865207a65726f206164647265604482015262737360e81b606482015260840161027a565b6001600160a01b0383811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b92591015b60405180910390a3505050565b505050565b6001600160a01b03166000908152602081905260409020545b919050565b505050565b600060208083528351808285015260005b818110156103c857858101830151858201604001528201613ac565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b038116811461040057600080fd5b919050565b6000806040838503121561041857600080fd5b610421836103e9565b946020939093013593505050565b60008060006060848603121561044457600080fd5b61044d846103e9565b925061045b602085016103e9565b9150604084013590509250925092565b600181811c9082168061047f57607f821691505b60208210810361049f57634e487b7160e01b600052602260045260246000fd5b5091905056fea26469706673582212206b5c7a7b9e2c8f1d3a4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c64736f6c63430008120033";

export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_symbol", "type": "string" },
      { "internalType": "uint256", "name": "_totalSupply", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "spender", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Approval",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "sender", "type": "address" },
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];