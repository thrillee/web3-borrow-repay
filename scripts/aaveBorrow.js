const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("./getWeth");

const main = async() => {
    await getWeth();

    const { deployer } = await getNamedAccounts();

    //Lending Pool Address Provider: 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
    const lendingPool = await getLendingPool(deployer);
    const lendingPoolAddress = lendingPool.address;
    console.log(`Lending pool address ${lendingPoolAddress}`);

    //Deposit
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    await approveErc20(wethTokenAddress, lendingPoolAddress, AMOUNT, deployer);
    console.log("Depositing...");

    //deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
    console.log("Deposited...");

    //Borrow
    let { totalDebtETH, availableBorrowsETH } = await getBorrowUserData(
        lendingPool,
        deployer
    );

    const daiPrice = await getDaiPrice();

    // the 0.95 is to get 95% of the initial availableBorrowsETH
    const amountDaiToBorrow =
        availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());

    console.log(`You can borrow ${amountDaiToBorrow} DAI`);

    const amountDaiToBorrowWei = ethers.utils.parseEther(
        amountDaiToBorrow.toString()
    );

    console.log("");
    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    await borrowDAI(
        daiTokenAddress,
        lendingPool,
        amountDaiToBorrowWei,
        deployer
    );

    console.log("");
    await getBorrowUserData(lendingPool, deployer);

    await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer);

    console.log("");
    await getBorrowUserData(lendingPool, deployer);
};

const repay = async(amount, daiAddress, lendingPool, account) => {
    await approveErc20(daiAddress, lendingPool.address, amount, account);

    // repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
    await repayTx.wait(1);
    console.log("repaid!");
};

const borrowDAI = async(
    daiAddress,
    lendingPool,
    amountDaiToBorrowWei,
    account
) => {
    // borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)
    // interest rate mode could be "variable:2" or "stable:1"
    const borrowTx = await lendingPool.borrow(
        daiAddress,
        amountDaiToBorrowWei,
        1,
        0,
        account
    );
    await borrowTx.wait(1);
    console.log(`You've borrowed ${amountDaiToBorrowWei}! (DAI wei)`);
};

const getDaiPrice = async() => {
    const ethAddress = "0x773616E4d11A78F511299002da57A0a94577F1f4";
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        ethAddress
    );

    // latestRoundData returns (
    //     uint80 roundId,
    //     int256 answer,
    //     uint256 startedAt,
    //     uint256 updatedAt,
    //     uint80 answeredInRound
    // )
    const price = (await daiEthPriceFeed.latestRoundData())[1];
    console.log(`Dai Eth price is ${price.toString()}`);
    return price;
};

const getBorrowUserData = async(lendingPool, account) => {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);

    console.log(
        `You have total amount of ${totalCollateralETH} ETH deposited `
    );
    console.log(`You have total debit of ${totalDebtETH} ETH borrowed `);
    console.log(`You can borrow ${availableBorrowsETH} ETH `);
    return { totalDebtETH, availableBorrowsETH };
};

const approveErc20 = async(
    erc20Address,
    spenderAddress,
    amountToSpend,
    account
) => {
    const erc20Token = await ethers.getContractAt(
        "IERC20",
        erc20Address,
        account
    );

    const tx = await erc20Token.approve(spenderAddress, amountToSpend);
    await tx.wait(1);
    console.log("Approved!");
};

const getLendingPool = async(account) => {
    const lendingPoolAddressProviderContractAddr =
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5";

    const lendingPoolAddressProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        lendingPoolAddressProviderContractAddr,
        account
    );

    const lendingPoolAddress =
        await lendingPoolAddressProvider.getLendingPool();
    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account
    );

    return lendingPool;
};

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.log(e);
        process.exit(1);
    });