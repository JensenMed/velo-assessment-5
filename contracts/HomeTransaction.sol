pragma solidity >=0.4.25 <0.6.0;

contract HomeTransaction {
    // Constants
    uint constant timeBetweenDepositAndFinalization = 5 minutes;
    uint constant depositPercentage = 10;

    enum ContractState {
        WaitingSellerSignature,
        WaitingBuyerSignature,
        WaitingRealtorReview,
        WaitingFinalization,
        Finalized,
        Rejected }
    ContractState public contractState = ContractState.WaitingSellerSignature;


    // Roles acting on contract
    address payable public realtor;
    address payable public seller;
    address payable public buyer;

    // Contract details
    string public homeAddress;
    string public zip;
    string public city;
    uint public realtorFee;
    uint public price;

    // Set when buyer signs and pays deposit
    uint public deposit;
    uint public finalizeDeadline;

    // Set when realtor reviews closing conditions
    enum ClosingConditionsReview { Pending, Accepted, Rejected }
    ClosingConditionsReview closingConditionsReview = ClosingConditionsReview.Pending;

    event StateChanged(ContractState newState);
    event DepositPaid(address indexed by, uint amount);
    event TransactionFinalized(uint sellerPaid, uint realtorPaid);
    event TransactionRejected(address indexed by);

    constructor(
        string memory _address,
        string memory _zip,
        string memory _city,
        uint _realtorFee,
        uint _price,
        address payable _realtor,
        address payable _seller,
        address payable _buyer) public {
        require(_price >= _realtorFee, "Price needs to be more than realtor fee!");
        require(_price * depositPercentage / 100 >= _realtorFee, "Minimum deposit must cover realtor fee");

        realtor = _realtor;
        seller = _seller;
        buyer = _buyer;
        homeAddress = _address;
        zip = _zip;
        city = _city;
        price = _price;
        realtorFee = _realtorFee;
    }

    function sellerSignContract() public payable {
        require(seller == msg.sender, "Only seller can sign contract");
        require(contractState == ContractState.WaitingSellerSignature, "Wrong contract state");

        contractState = ContractState.WaitingBuyerSignature;
        emit StateChanged(contractState);
    }

    function buyerSignContractAndPayDeposit() public payable {
        require(buyer == msg.sender, "Only buyer can sign contract");
        require(contractState == ContractState.WaitingBuyerSignature, "Wrong contract state");
        require(msg.value >= price*depositPercentage/100 && msg.value <= price, "Buyer needs to deposit between 10% and 100% to sign contract");

        contractState = ContractState.WaitingRealtorReview;
        deposit = msg.value;
        finalizeDeadline = now + timeBetweenDepositAndFinalization;

        emit DepositPaid(msg.sender, msg.value);
        emit StateChanged(contractState);
    }

    function realtorReviewedClosingConditions(bool accepted) public {
        require(realtor == msg.sender, "Only realtor can review closing conditions");
        require(contractState == ContractState.WaitingRealtorReview, "Wrong contract state");

        if (accepted) {
            closingConditionsReview = ClosingConditionsReview.Accepted;
            contractState = ContractState.WaitingFinalization;
            emit StateChanged(contractState);
        } else {
            closingConditionsReview = ClosingConditionsReview.Rejected;
            contractState = ContractState.Rejected;
            buyer.transfer(deposit);
            emit TransactionRejected(msg.sender);
            emit StateChanged(contractState);
        }
    }

    function buyerFinalizeTransaction() public payable {
        require(buyer == msg.sender, "Only buyer can finalize transaction");
        require(contractState == ContractState.WaitingFinalization, "Wrong contract state");
        require(now <= finalizeDeadline, "Finalization deadline has passed");
        require(msg.value + deposit == price, "Buyer needs to pay the rest of the cost to finalize transaction");

        contractState = ContractState.Finalized;
        seller.transfer(price - realtorFee);
        realtor.transfer(realtorFee);

        emit TransactionFinalized(price - realtorFee, realtorFee);
        emit StateChanged(contractState);
    }

    function anyWithdrawFromTransaction() public {
        require(buyer == msg.sender || finalizeDeadline <= now, "Only buyer can withdraw before transaction deadline");
        require(contractState == ContractState.WaitingFinalization, "Wrong contract state");

        contractState = ContractState.Rejected;
        seller.transfer(deposit - realtorFee);
        realtor.transfer(realtorFee);

        emit TransactionRejected(msg.sender);
        emit StateChanged(contractState);
    }
}