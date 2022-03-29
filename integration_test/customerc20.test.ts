/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { expect } from 'chai'
import { BigNumber } from '@ethersproject/bignumber'
import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { L1CustomGateway__factory } from '../src/lib/abi/factories/L1CustomGateway__factory'
import { L1GatewayRouter__factory } from '../src/lib/abi/factories/L1GatewayRouter__factory'
import { L2GatewayRouter__factory } from '../src/lib/abi/factories/L2GatewayRouter__factory'
import { TestArbCustomToken__factory } from '../src/lib/abi/factories/TestArbCustomToken__factory'
import { L2ToL1MessageStatus } from '../src/lib/message/L2ToL1Message'
import {
  fundL1,
  fundL2,
  instantiateBridgeWithRandomWallet,
  skipIfMainnet,
  depositToken,
} from './testHelpers'
import { L1ToL2MessageStatus, L2Network } from '../src'
import { Signer, constants, ContractFactory } from 'ethers'
import { AdminErc20Bridger } from '../src/lib/assetBridger/erc20Bridger'
import { TestCustomTokenL1 } from '../src/lib/abi/TestCustomTokenL1'

const testCustomTokenAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_bridge',
        type: 'address',
      },
      {
        internalType: 'address',
        name: '_router',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Approval',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'from',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'to',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
    ],
    name: 'allowance',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'approve',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'bridge',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'subtractedValue',
        type: 'uint256',
      },
    ],
    name: 'decreaseAllowance',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'addedValue',
        type: 'uint256',
      },
    ],
    name: 'increaseAllowance',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isArbitrumEnabled',
    outputs: [
      {
        internalType: 'uint8',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'nonces',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'spender',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'value',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'deadline',
        type: 'uint256',
      },
      {
        internalType: 'uint8',
        name: 'v',
        type: 'uint8',
      },
      {
        internalType: 'bytes32',
        name: 'r',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 's',
        type: 'bytes32',
      },
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'l2CustomTokenAddress',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'maxSubmissionCostForCustomBridge',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxSubmissionCostForRouter',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasForCustomBridge',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'maxGasForRouter',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'gasPriceBid',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'valueForGateway',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'valueForRouter',
        type: 'uint256',
      },
      {
        internalType: 'address',
        name: 'creditBackAddress',
        type: 'address',
      },
    ],
    name: 'registerTokenOnL2',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'router',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [
      {
        internalType: 'string',
        name: '',
        type: 'string',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transfer',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_to',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: '_value',
        type: 'uint256',
      },
      {
        internalType: 'bytes',
        name: '_data',
        type: 'bytes',
      },
    ],
    name: 'transferAndCall',
    outputs: [
      {
        internalType: 'bool',
        name: 'success',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'recipient',
        type: 'address',
      },
      {
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'transferFrom',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
const testCustomTokenBytecode =
  '0x60806040523480156200001157600080fd5b506040516200267838038062002678833981810160405260408110156200003757600080fd5b508051602090910151600054610100900460ff1680620000655750620000656001600160e01b036200018216565b8062000074575060005460ff16155b620000b15760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff16158015620000dd576000805460ff1961ff0019909116610100171660011790555b8015620000f0576000805461ff00191690555b5060cc80546001600160a01b038085166001600160a01b03199283161790925560cd805492841692909116919091179055604080518082018252600f81526e2a32b9ba21bab9ba37b6aa37b5b2b760891b6020808301919091528251808401909352600483526321a0a92160e11b838201526200017a929060129062000cfd620001a1821b17901c565b505062000875565b60006200019a306200029460201b62000dbe1760201c565b1590505b90565b600054610100900460ff1680620001c65750620001c66001600160e01b036200018216565b80620001d5575060005460ff16155b620002125760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff161580156200023e576000805460ff1961ff0019909116610100171660011790555b62000252846001600160e01b036200029a16565b6200026784846001600160e01b03620003a016565b6200027b826001600160e01b036200047d16565b80156200028e576000805461ff00191690555b50505050565b3b151590565b600054610100900460ff1680620002bf5750620002bf6001600160e01b036200018216565b80620002ce575060005460ff16155b6200030b5760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff1615801562000337576000805460ff1961ff0019909116610100171660011790555b6200034a6001600160e01b036200049316565b6200037582604051806040016040528060018152602001603160f81b8152506200054660201b60201c565b62000389826001600160e01b036200061716565b80156200039c576000805461ff00191690555b5050565b600054610100900460ff1680620003c55750620003c56001600160e01b036200018216565b80620003d4575060005460ff16155b620004115760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff161580156200043d576000805460ff1961ff0019909116610100171660011790555b620004506001600160e01b036200049316565b6200046583836001600160e01b03620006e616565b801562000478576000805461ff00191690555b505050565b6038805460ff191660ff92909216919091179055565b600054610100900460ff1680620004b85750620004b86001600160e01b036200018216565b80620004c7575060005460ff16155b620005045760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff1615801562000530576000805460ff1961ff0019909116610100171660011790555b801562000543576000805461ff00191690555b50565b600054610100900460ff16806200056b57506200056b6001600160e01b036200018216565b806200057a575060005460ff16155b620005b75760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff16158015620005e3576000805460ff1961ff0019909116610100171660011790555b8251602080850191909120835191840191909120606591909155606655801562000478576000805461ff0019169055505050565b600054610100900460ff16806200063c57506200063c6001600160e01b036200018216565b806200064b575060005460ff16155b620006885760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff16158015620006b4576000805460ff1961ff0019909116610100171660011790555b604051806052620025f88239604051908190036052019020609a555080156200039c576000805461ff00191690555050565b600054610100900460ff16806200070b57506200070b6001600160e01b036200018216565b806200071a575060005460ff16155b620007575760405162461bcd60e51b815260040180806020018281038252602e8152602001806200264a602e913960400191505060405180910390fd5b600054610100900460ff1615801562000783576000805460ff1961ff0019909116610100171660011790555b825162000798906036906020860190620007d3565b508151620007ae906037906020850190620007d3565b506038805460ff19166012179055801562000478576000805461ff0019169055505050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106200081657805160ff191683800117855562000846565b8280016001018555821562000846579182015b828111156200084657825182559160200191906001019062000829565b506200085492915062000858565b5090565b6200019e91905b808211156200085457600081556001016200085f565b611d7380620008856000396000f3fe60806040526004361061011f5760003560e01c80637ecebe00116100a0578063d505accf11610064578063d505accf146104bf578063dd62ed3e1461051d578063e78cea9214610558578063f887ea4014610589578063fc792d8e1461059e5761011f565b80637ecebe00146103f05780638e5f5ad11461042357806395d89b4114610438578063a457c2d71461044d578063a9059cbb146104865761011f565b8063313ce567116100e7578063313ce5671461027c5780633644e515146102a757806339509351146102bc5780634000aea0146102f557806370a08231146103bd5761011f565b806306fdde0314610124578063095ea7b3146101ae5780631249c58b146101fb57806318160ddd1461021257806323b872dd14610239575b600080fd5b34801561013057600080fd5b506101396105fa565b6040805160208082528351818301528351919283929083019185019080838360005b8381101561017357818101518382015260200161015b565b50505050905090810190601f1680156101a05780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3480156101ba57600080fd5b506101e7600480360360408110156101d157600080fd5b506001600160a01b038135169060200135610691565b604080519115158252519081900360200190f35b34801561020757600080fd5b506102106106ae565b005b34801561021e57600080fd5b506102276106be565b60408051918252519081900360200190f35b34801561024557600080fd5b506101e76004803603606081101561025c57600080fd5b506001600160a01b038135811691602081013590911690604001356106c4565b34801561028857600080fd5b506102916106d9565b6040805160ff9092168252519081900360200190f35b3480156102b357600080fd5b506102276106e2565b3480156102c857600080fd5b506101e7600480360360408110156102df57600080fd5b506001600160a01b0381351690602001356106f1565b34801561030157600080fd5b506101e76004803603606081101561031857600080fd5b6001600160a01b038235169160208101359181019060608101604082013564010000000081111561034857600080fd5b82018360208201111561035a57600080fd5b8035906020019184600183028401116401000000008311171561037c57600080fd5b91908080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525092955061074a945050505050565b3480156103c957600080fd5b50610227600480360360208110156103e057600080fd5b50356001600160a01b031661082f565b3480156103fc57600080fd5b506102276004803603602081101561041357600080fd5b50356001600160a01b0316610840565b34801561042f57600080fd5b50610291610861565b34801561044457600080fd5b506101396108bd565b34801561045957600080fd5b506101e76004803603604081101561047057600080fd5b506001600160a01b03813516906020013561091e565b34801561049257600080fd5b506101e7600480360360408110156104a957600080fd5b506001600160a01b03813516906020013561098c565b3480156104cb57600080fd5b50610210600480360360e08110156104e257600080fd5b506001600160a01b03813581169160208101359091169060408101359060608101359060ff6080820135169060a08101359060c001356109a0565b34801561052957600080fd5b506102276004803603604081101561054057600080fd5b506001600160a01b0381358116916020013516610b38565b34801561056457600080fd5b5061056d610b63565b604080516001600160a01b039092168252519081900360200190f35b34801561059557600080fd5b5061056d610b72565b61021060048036036101208110156105b557600080fd5b506001600160a01b03813581169160208101359160408201359160608101359160808201359160a08101359160c08201359160e0810135916101009091013516610b81565b60368054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156106865780601f1061065b57610100808354040283529160200191610686565b820191906000526020600020905b81548152906001019060200180831161066957829003601f168201915b505050505090505b90565b60006106a561069e610dc4565b8484610dc8565b50600192915050565b6106bc336302faf080610eb4565b565b60355490565b60006106d1848484610fb2565b949350505050565b60385460ff1690565b60006106ec611030565b905090565b60006106a56106fe610dc4565b84610745856034600061070f610dc4565b6001600160a01b03908116825260208083019390935260409182016000908120918c16815292529020549063ffffffff61106316565b610dc8565b6000610756848461098c565b50836001600160a01b0316336001600160a01b03167fe19260aff97b920c7df27010903aeb9c8d2be5d310a2c67824cf3f15396e4c1685856040518083815260200180602001828103825283818151815260200191508051906020019080838360005b838110156107d15781810151838201526020016107b9565b50505050905090810190601f1680156107fe5780820380516001836020036101000a031916815260200191505b50935050505060405180910390a361081584610dbe565b15610825576108258484846110c4565b5060019392505050565b600061083a8261119e565b92915050565b6001600160a01b038116600090815260996020526040812061083a906111b9565b60cd54600090600160a01b900460ff166108b6576040805162461bcd60e51b81526020600482015260116024820152701393d517d156141150d5115117d0d05313607a1b604482015290519081900360640190fd5b5061a4b190565b60378054604080516020601f60026000196101006001881615020190951694909404938401819004810282018101909252828152606093909290918301828280156106865780601f1061065b57610100808354040283529160200191610686565b60006106a561092b610dc4565b8461074585604051806060016040528060258152602001611d196025913960346000610955610dc4565b6001600160a01b03908116825260208083019390935260409182016000908120918d1681529252902054919063ffffffff6111bd16565b60006106a5610999610dc4565b8484611254565b834211156109f5576040805162461bcd60e51b815260206004820152601d60248201527f45524332305065726d69743a206578706972656420646561646c696e65000000604482015290519081900360640190fd5b6000609a54888888610a2a609960008e6001600160a01b03166001600160a01b031681526020019081526020016000206111b9565b604080516020808201979097526001600160a01b0395861681830152939094166060840152608083019190915260a082015260c08082018990528251808303909101815260e0909101909152805191012090506000610a88826113bd565b90506000610a9882878787611409565b9050896001600160a01b0316816001600160a01b031614610b00576040805162461bcd60e51b815260206004820152601e60248201527f45524332305065726d69743a20696e76616c6964207369676e61747572650000604482015290519081900360640190fd5b6001600160a01b038a166000908152609960205260409020610b2190611574565b610b2c8a8a8a610dc8565b50505050505050505050565b6001600160a01b03918216600090815260346020908152604080832093909416825291909152205490565b60cc546001600160a01b031681565b60cd546001600160a01b031681565b60cd8054600160a01b60ff60a01b198216811790925560cc546040805163651a36a560e11b81526001600160a01b038e81166004830152602482018c9052604482018a9052606482018e9052868116608483015291519490930460ff169391169163ca346d4a91879160a48082019260209290919082900301818588803b158015610c0b57600080fd5b505af1158015610c1f573d6000803e3d6000fd5b50505050506040513d6020811015610c3657600080fd5b505060cd5460cc5460408051632d67b72d60e01b81526001600160a01b039283166004820152602481018a905260448101899052606481018c9052858316608482015290519190921691632d67b72d91869160a48082019260209290919082900301818588803b158015610ca957600080fd5b505af1158015610cbd573d6000803e3d6000fd5b50505050506040513d6020811015610cd457600080fd5b505060cd8054911515600160a01b0260ff60a01b19909216919091179055505050505050505050565b600054610100900460ff1680610d165750610d1661157d565b80610d24575060005460ff16155b610d5f5760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff16158015610d8a576000805460ff1961ff0019909116610100171660011790555b610d938461158e565b610d9d8484611665565b610da68261171b565b8015610db8576000805461ff00191690555b50505050565b3b151590565b3390565b6001600160a01b038316610e0d5760405162461bcd60e51b8152600401808060200182810382526024815260200180611cf56024913960400191505060405180910390fd5b6001600160a01b038216610e525760405162461bcd60e51b8152600401808060200182810382526022815260200180611b4a6022913960400191505060405180910390fd5b6001600160a01b03808416600081815260346020908152604080832094871680845294825291829020859055815185815291517f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259281900390910190a3505050565b6001600160a01b038216610f0f576040805162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f206164647265737300604482015290519081900360640190fd5b610f1b60008383611716565b603554610f2e908263ffffffff61106316565b6035556001600160a01b038216600090815260336020526040902054610f5a908263ffffffff61106316565b6001600160a01b03831660008181526033602090815260408083209490945583518581529351929391927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35050565b6000610fbf848484611254565b61082584610fcb610dc4565b61074585604051806060016040528060288152602001611ca8602891396001600160a01b038a16600090815260346020526040812090611009610dc4565b6001600160a01b03168152602081019190915260400160002054919063ffffffff6111bd16565b60006106ec6040518080611c566052913960520190506040518091039020611056611731565b61105e611737565b61173d565b6000828201838110156110bd576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b9392505050565b604051635260769b60e11b815233600482018181526024830185905260606044840190815284516064850152845187946001600160a01b0386169463a4c0ed369490938993899360840190602085019080838360005b8381101561113257818101518382015260200161111a565b50505050905090810190601f16801561115f5780820380516001836020036101000a031916815260200191505b50945050505050600060405180830381600087803b15801561118057600080fd5b505af1158015611194573d6000803e3d6000fd5b5050505050505050565b6001600160a01b031660009081526033602052604090205490565b5490565b6000818484111561124c5760405162461bcd60e51b81526004018080602001828103825283818151815260200191508051906020019080838360005b838110156112115781810151838201526020016111f9565b50505050905090810190601f16801561123e5780820380516001836020036101000a031916815260200191505b509250505060405180910390fd5b505050900390565b6001600160a01b0383166112995760405162461bcd60e51b8152600401808060200182810382526025815260200180611cd06025913960400191505060405180910390fd5b6001600160a01b0382166112de5760405162461bcd60e51b8152600401808060200182810382526023815260200180611b276023913960400191505060405180910390fd5b6112e9838383611716565b61132c81604051806060016040528060268152602001611b6c602691396001600160a01b038616600090815260336020526040902054919063ffffffff6111bd16565b6001600160a01b038085166000908152603360205260408082209390935590841681522054611361908263ffffffff61106316565b6001600160a01b0380841660008181526033602090815260409182902094909455805185815290519193928716927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef92918290030190a3505050565b60006113c7611030565b82604051602001808061190160f01b81525060020183815260200182815260200192505050604051602081830303815290604052805190602001209050919050565b60006fa2a8918ca85bafe22016d0b997e4df60600160ff1b038211156114605760405162461bcd60e51b8152600401808060200182810382526022815260200180611b926022913960400191505060405180910390fd5b8360ff16601b148061147557508360ff16601c145b6114b05760405162461bcd60e51b8152600401808060200182810382526022815260200180611c346022913960400191505060405180910390fd5b604080516000808252602080830180855289905260ff88168385015260608301879052608083018690529251909260019260a080820193601f1981019281900390910190855afa158015611508573d6000803e3d6000fd5b5050604051601f1901519150506001600160a01b03811661156b576040805162461bcd60e51b815260206004820152601860248201527745434453413a20696e76616c6964207369676e617475726560401b604482015290519081900360640190fd5b95945050505050565b80546001019055565b600061158830610dbe565b15905090565b600054610100900460ff16806115a757506115a761157d565b806115b5575060005460ff16155b6115f05760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff1615801561161b576000805460ff1961ff0019909116610100171660011790555b611623611793565b61164682604051806040016040528060018152602001603160f81b815250611835565b61164f826118f5565b8015611661576000805461ff00191690555b5050565b600054610100900460ff168061167e575061167e61157d565b8061168c575060005460ff16155b6116c75760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff161580156116f2576000805460ff1961ff0019909116610100171660011790555b6116fa611793565b61170483836119b2565b8015611716576000805461ff00191690555b505050565b6038805460ff191660ff92909216919091179055565b60655490565b60665490565b600083838361174a611a8a565b6040805160208082019690965280820194909452606084019290925260808301523060a0808401919091528151808403909101815260c090920190528051910120949350505050565b600054610100900460ff16806117ac57506117ac61157d565b806117ba575060005460ff16155b6117f55760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff16158015611820576000805460ff1961ff0019909116610100171660011790555b8015611832576000805461ff00191690555b50565b600054610100900460ff168061184e575061184e61157d565b8061185c575060005460ff16155b6118975760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff161580156118c2576000805460ff1961ff0019909116610100171660011790555b82516020808501919091208351918401919091206065919091556066558015611716576000805461ff0019169055505050565b600054610100900460ff168061190e575061190e61157d565b8061191c575060005460ff16155b6119575760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff16158015611982576000805460ff1961ff0019909116610100171660011790555b604051806052611bb48239604051908190036052019020609a55508015611661576000805461ff00191690555050565b600054610100900460ff16806119cb57506119cb61157d565b806119d9575060005460ff16155b611a145760405162461bcd60e51b815260040180806020018281038252602e815260200180611c06602e913960400191505060405180910390fd5b600054610100900460ff16158015611a3f576000805460ff1961ff0019909116610100171660011790555b8251611a52906036906020860190611a8e565b508151611a66906037906020850190611a8e565b506038805460ff191660121790558015611716576000805461ff0019169055505050565b4690565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10611acf57805160ff1916838001178555611afc565b82800160010185558215611afc579182015b82811115611afc578251825591602001919060010190611ae1565b50611b08929150611b0c565b5090565b61068e91905b80821115611b085760008155600101611b1256fe45524332303a207472616e7366657220746f20746865207a65726f206164647265737345524332303a20617070726f766520746f20746865207a65726f206164647265737345524332303a207472616e7366657220616d6f756e7420657863656564732062616c616e636545434453413a20696e76616c6964207369676e6174757265202773272076616c75655065726d69742861646472657373206f776e65722c61646472657373207370656e6465722c75696e743235362076616c75652c75696e74323536206e6f6e63652c75696e7432353620646561646c696e6529496e697469616c697a61626c653a20636f6e747261637420697320616c726561647920696e697469616c697a656445434453413a20696e76616c6964207369676e6174757265202776272076616c7565454950373132446f6d61696e28737472696e67206e616d652c737472696e672076657273696f6e2c75696e7432353620636861696e49642c6164647265737320766572696679696e67436f6e74726163742945524332303a207472616e7366657220616d6f756e74206578636565647320616c6c6f77616e636545524332303a207472616e736665722066726f6d20746865207a65726f206164647265737345524332303a20617070726f76652066726f6d20746865207a65726f206164647265737345524332303a2064656372656173656420616c6c6f77616e63652062656c6f77207a65726fa26469706673582212201039ae281f138b14236c1d44df089d9d35258e70def17cb9480b1f0dbfd698e964736f6c634300060b00335065726d69742861646472657373206f776e65722c61646472657373207370656e6465722c75696e743235362076616c75652c75696e74323536206e6f6e63652c75696e7432353620646561646c696e6529496e697469616c697a61626c653a20636f6e747261637420697320616c726561647920696e697469616c697a6564'
const depositAmount = BigNumber.from(100)
const withdrawalAmount = BigNumber.from(10)

describe('Custom ERC20', () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // test globals
  let testState: {
    l1Signer: Signer
    l2Signer: Signer
    adminErc20Bridger: AdminErc20Bridger
    l2Network: L2Network
    l1CustomToken: TestCustomTokenL1
  }

  before('init', async () => {
    testState = {
      ...(await instantiateBridgeWithRandomWallet()),
      l1CustomToken: {} as any,
    }
    await fundL1(testState.l1Signer)
    await fundL2(testState.l2Signer)
  })

  it.only('register custom token', async () => {
    const { l1CustomToken: l1Token } = await registerCustomToken(
      testState.l2Network,
      testState.l1Signer,
      testState.l2Signer,
      testState.adminErc20Bridger
    )
    testState.l1CustomToken = l1Token
  })

  it('deposit', async () => {
    await (
      await testState.l1CustomToken.connect(testState.l1Signer).mint()
    ).wait()
    await depositToken(
      depositAmount,
      testState.l1CustomToken.address,
      testState.adminErc20Bridger,
      testState.l1Signer,
      testState.l2Signer,
      L1ToL2MessageStatus.REDEEMED
    )
  })

  it('withdraws erc20', async function () {
    const l2Token = testState.adminErc20Bridger.getL2TokenContract(
      testState.l2Signer.provider!,
      await testState.adminErc20Bridger.getL2ERC20Address(
        testState.l1CustomToken.address,
        testState.l1Signer.provider!
      )
    )

    const withdrawRes = await testState.adminErc20Bridger.withdraw({
      amount: withdrawalAmount,
      erc20l1Address: testState.l1CustomToken.address,
      l2Signer: testState.l2Signer,
    })
    const withdrawRec = await withdrawRes.wait()

    expect(withdrawRec.status).to.equal(1, 'initiate token withdraw txn failed')

    const message = (
      await withdrawRec.getL2ToL1Messages(
        testState.l1Signer.provider!,
        testState.l2Network
      )
    )[0]
    expect(message, 'withdrawEventData not found').to.exist

    const messageStatus = await message.status(null, withdrawRec.blockHash)
    expect(
      messageStatus === L2ToL1MessageStatus.UNCONFIRMED,
      `custom token withdraw status returned ${messageStatus}`
    ).to.be.true

    const testWalletL2Balance = await l2Token.balanceOf(
      await testState.l2Signer.getAddress()
    )
    expect(
      testWalletL2Balance.toNumber(),
      'token withdraw balance not deducted'
    ).to.eq(depositAmount.sub(withdrawalAmount).toNumber())
    const walletAddress = await testState.l1Signer.getAddress()

    const gatewayAddress = await testState.adminErc20Bridger.getL2GatewayAddress(
      testState.l1CustomToken.address,
      testState.l2Signer.provider!
    )
    expect(gatewayAddress, 'Gateway is not custom gateway').to.eq(
      testState.adminErc20Bridger.l2Network.tokenBridge.l2CustomGateway
    )

    const gatewayWithdrawEvents = await testState.adminErc20Bridger.getL2WithdrawalEvents(
      testState.l2Signer.provider!,
      gatewayAddress,
      { fromBlock: withdrawRec.blockNumber, toBlock: 'latest' },
      testState.l1CustomToken.address,
      walletAddress
    )
    expect(gatewayWithdrawEvents.length).to.equal(
      1,
      'token custom gateway query failed'
    )
  })
})

const registerCustomToken = async (
  l2Network: L2Network,
  l1Signer: Signer,
  l2Signer: Signer,
  adminErc20Bridger: AdminErc20Bridger
) => {
  // create a custom token on L1 and L2
  // CHRIS: TODO: use the proper abi here
  const l1CustomTokenFac = new ContractFactory(
    testCustomTokenAbi,
    testCustomTokenBytecode,
    l1Signer
  )
  const l1CustomToken = (await l1CustomTokenFac.deploy(
    l2Network.tokenBridge.l1CustomGateway,
    l2Network.tokenBridge.l1GatewayRouter
  )) as TestCustomTokenL1
  await l1CustomToken.deployed()

  const l2CustomTokenFac = new TestArbCustomToken__factory(l2Signer)
  const l2CustomToken = await l2CustomTokenFac.deploy(
    l2Network.tokenBridge.l2CustomGateway,
    l1CustomToken.address
  )
  await l2CustomToken.deployed()

  // check starting conditions - should initially use the default gateway
  const l1GatewayRouter = new L1GatewayRouter__factory(l1Signer).attach(
    l2Network.tokenBridge.l1GatewayRouter
  )
  const l2GatewayRouter = new L2GatewayRouter__factory(l2Signer).attach(
    l2Network.tokenBridge.l2GatewayRouter
  )
  const l1CustomGateway = new L1CustomGateway__factory(l1Signer).attach(
    l2Network.tokenBridge.l1CustomGateway
  )
  const l2CustomGateway = new L1CustomGateway__factory(l2Signer).attach(
    l2Network.tokenBridge.l2CustomGateway
  )
  const startL1GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l1CustomToken.address
  )
  expect(
    startL1GatewayAddress,
    'Start l1GatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL2GatewayAddress = await l2GatewayRouter.l1TokenToGateway(
    l2CustomToken.address
  )
  expect(
    startL2GatewayAddress,
    'Start l2GatewayAddress not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL1Erc20Address = await l1CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    startL1Erc20Address,
    'Start l1Erc20Address not equal empty address'
  ).to.eq(constants.AddressZero)
  const startL2Erc20Address = await l2CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    startL2Erc20Address,
    'Start l2Erc20Address not equal empty address'
  ).to.eq(constants.AddressZero)

  // send the messages
  const regTx = await adminErc20Bridger.registerCustomToken(
    l1CustomToken.address,
    l2CustomToken.address,
    l1Signer,
    l2Signer.provider!
  )
  const regRec = await regTx.wait()

  // wait on messages
  const l1ToL2Messages = await regRec.getL1ToL2Messages(l2Signer.provider!)
  expect(l1ToL2Messages.length, 'Should be 2 messages.').to.eq(2)

  const setTokenTx = await l1ToL2Messages[0].waitForStatus()
  expect(setTokenTx.status, 'Set token not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )
  // CHRIS: TODO: remove
  console.log("wait for status 1")

  const setGateways = await l1ToL2Messages[1].waitForStatus()
  expect(setGateways.status, 'Set gateways not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )

  // check end conditions
  const endL1GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l1CustomToken.address
  )
  expect(
    endL1GatewayAddress,
    'End l1GatewayAddress not equal to l1 custom gateway'
  ).to.eq(l2Network.tokenBridge.l1CustomGateway)
  const endL2GatewayAddress = await l1GatewayRouter.l1TokenToGateway(
    l2CustomToken.address
  )
  expect(
    endL2GatewayAddress,
    'End l2GatewayAddress not equal to l1 custom gateway'
  ).to.eq(l2Network.tokenBridge.l1CustomGateway)

  const endL1Erc20Address = await l1CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    endL1Erc20Address,
    'End l1Erc20Address not equal l1CustomToken address'
  ).to.eq(l2CustomToken.address)
  const endL2Erc20Address = await l2CustomGateway.l1ToL2Token(
    l1CustomToken.address
  )
  expect(
    endL2Erc20Address,
    'End l2Erc20Address not equal l2CustomToken address'
  ).to.eq(l2CustomToken.address)

  return {
    l1CustomToken,
    l2CustomToken,
  }
}
