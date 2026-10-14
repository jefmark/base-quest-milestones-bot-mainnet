// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
interface IQuest {
    function startRun(uint256) external returns(uint64, bytes32);
    function cancelRun() external;
    function mintMilestone(uint256,uint256,uint256,uint64) external returns(uint256);
}
contract ReentrantReceiver is IERC721Receiver {
    IQuest public quest;
    bool public cancelSucceeded;
    bool public mintSucceeded;
    constructor(address target){quest=IQuest(target);}
    function start() external {quest.startRun(1);}
    function mint() external {quest.mintMilestone(1,1200,20,1);}
    function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){
        require(msg.sender==address(quest));
        (cancelSucceeded,)=address(quest).call(abi.encodeCall(IQuest.cancelRun,()));
        (mintSucceeded,)=address(quest).call(abi.encodeCall(IQuest.mintMilestone,(2,2600,35,1)));
        return IERC721Receiver.onERC721Received.selector;
    }
}
