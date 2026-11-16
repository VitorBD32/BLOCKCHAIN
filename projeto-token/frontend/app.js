// Endereço do contrato UESPI na Sepolia.
const contractAddress = "0x7Afd1aacA2123646E25F48e0e9bEBae019370749";

const contractABI = [
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
		"name": "decimals",
		"outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
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
		"inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
		"name": "balanceOf",
		"outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "transfer",
		"outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "amount", "type": "uint256" }
		],
		"name": "mint",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
		"name": "burn",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

const SEPOLIA_CHAIN_ID = "0xaa36a7";
let provider, signer, contract, decimais = 18, simbolo = "UESPI";

function enderecoValido(valor) {
	return typeof valor === "string" && /^0x[a-fA-F0-9]{40}$/.test(valor);
}

function mensagemErro(error) {
	if (!error) return "Erro desconhecido.";
	if (error.code === 4001 || error.code === 401) return "A operação foi rejeitada na MetaMask.";
	if (error.code === -32002) return "Já existe uma janela da MetaMask à espera de aprovação. Clica no ícone da raposa.";
	const texto = error.reason || error.data?.message || error.message || String(error);
	if (/insufficient funds/i.test(texto)) return "Saldo de SepoliaETH insuficiente para o gas.";
	if (/transfer amount exceeds balance/i.test(texto)) return "A quantidade é maior do que o saldo de UESPI.";
	return texto;
}

async function mudarParaSepolia() {
	const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
	if (currentChainId === SEPOLIA_CHAIN_ID) return;

	try {
		await window.ethereum.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: SEPOLIA_CHAIN_ID }]
		});
	} catch (switchError) {
		if (switchError.code === 4902) {
			await window.ethereum.request({
				method: "wallet_addEthereumChain",
				params: [{
					chainId: SEPOLIA_CHAIN_ID,
					chainName: "Sepolia",
					nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
					rpcUrls: ["https://rpc.sepolia.org"],
					blockExplorerUrls: ["https://sepolia.etherscan.io"]
				}]
			});
		} else {
			throw switchError;
		}
	}
}

function formatarQuantidade(valor) {
	const texto = ethers.utils.formatUnits(valor, decimais);
	const numero = Number(texto);
	if (!Number.isFinite(numero)) return texto;
	return numero.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function encurtar(endereco) {
	return endereco.slice(0, 6) + "..." + endereco.slice(-4);
}

async function atualizarSaldo() {
	const conta = await signer.getAddress();
	const saldo = await contract.balanceOf(conta);
	const supply = await contract.totalSupply();
	document.getElementById("saldo").innerText = formatarQuantidade(saldo) + " " + simbolo;
	document.getElementById("supply").innerText = "Supply total: " + formatarQuantidade(supply) + " " + simbolo;
	document.getElementById("conta").innerText = conta;
	document.getElementById("contaCurta").innerText = encurtar(conta);
}

async function conectarCarteira() {
	if (!window.ethereum) {
		alert("Instala a extensão MetaMask neste navegador e recarrega a página.");
		return;
	}
	if (!enderecoValido(contractAddress)) {
		alert("O endereço do contrato na primeira linha de app.js ainda está abreviado (0x7Af...70749). Substitui pelo endereço completo de 42 caracteres e recarrega a página.");
		return;
	}

	try {
		await window.ethereum.request({ method: "eth_requestAccounts" });
		await mudarParaSepolia();

		provider = new ethers.providers.Web3Provider(window.ethereum);
		signer = provider.getSigner();
		contract = new ethers.Contract(contractAddress, contractABI, signer);

		simbolo = await contract.symbol();
		decimais = await contract.decimals();
		const nome = await contract.name();

		document.getElementById("nomeToken").innerText = nome + " (" + simbolo + ")";
		document.getElementById("rede").innerText = "Rede: Sepolia";
		document.getElementById("linkContrato").textContent = contractAddress;
		document.getElementById("linkContrato").href = "https://sepolia.etherscan.io/address/" + contractAddress;
		document.getElementById("btnConnect").style.display = "none";
		document.getElementById("painel").hidden = false;
		document.getElementById("status").innerText = "Carteira conectada.";
		await atualizarSaldo();
	} catch (error) {
		console.error(error);
		alert("Erro ao conectar: " + mensagemErro(error));
	}
}

async function transferir() {
	if (!contract) return alert("Conecta a carteira primeiro.");
	const destino = document.getElementById("destino").value.trim();
	const quantidade = document.getElementById("quantidade").value.trim();
	if (!enderecoValido(destino)) return alert("Indica um endereço de destino válido.");
	if (!quantidade || Number(quantidade) <= 0) return alert("Indica uma quantidade maior do que zero.");

	try {
		await mudarParaSepolia();
		const amount = ethers.utils.parseUnits(quantidade, decimais);
		const tx = await contract.transfer(destino, amount);
		document.getElementById("txTransferencia").innerText = "Transação enviada: " + tx.hash;
		await tx.wait();
		document.getElementById("txTransferencia").innerText = "Transferência confirmada: " + tx.hash;
		document.getElementById("quantidade").value = "";
		await atualizarSaldo();
	} catch (error) {
		console.error(error);
		alert("Erro na transferência: " + mensagemErro(error));
	}
}

async function mintar() {
	if (!contract) return alert("Conecta a carteira primeiro.");
	const destino = document.getElementById("mintDestino").value.trim();
	const quantidade = document.getElementById("mintQuantidade").value.trim();
	if (!enderecoValido(destino)) return alert("Indica um endereço válido para o mint.");
	if (!quantidade || Number(quantidade) <= 0) return alert("Indica uma quantidade maior do que zero.");

	try {
		await mudarParaSepolia();
		const amount = ethers.utils.parseUnits(quantidade, decimais);
		const tx = await contract.mint(destino, amount);
		document.getElementById("txExtra").innerText = "Mint enviado: " + tx.hash;
		await tx.wait();
		document.getElementById("txExtra").innerText = "Mint confirmado: " + tx.hash;
		await atualizarSaldo();
	} catch (error) {
		console.error(error);
		alert("Erro no mint. Só a conta dona do contrato consegue executar esta função. " + mensagemErro(error));
	}
}

async function queimar() {
	if (!contract) return alert("Conecta a carteira primeiro.");
	const quantidade = document.getElementById("burnQuantidade").value.trim();
	if (!quantidade || Number(quantidade) <= 0) return alert("Indica uma quantidade maior do que zero.");

	try {
		await mudarParaSepolia();
		const amount = ethers.utils.parseUnits(quantidade, decimais);
		const tx = await contract.burn(amount);
		document.getElementById("txExtra").innerText = "Burn enviado: " + tx.hash;
		await tx.wait();
		document.getElementById("txExtra").innerText = "Burn confirmado: " + tx.hash;
		await atualizarSaldo();
	} catch (error) {
		console.error(error);
		alert("Erro no burn: " + mensagemErro(error));
	}
}

if (window.ethereum) {
	window.ethereum.on("chainChanged", () => window.location.reload());
	window.ethereum.on("accountsChanged", () => window.location.reload());
}
