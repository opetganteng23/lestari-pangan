// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Menyimpan hash event LestariPangan. Hanya hash; tanpa data pribadi. Satu kunci hanya bisa di-anchor sekali.
/// STATUS: belum diaudit dan belum dideploy. Gunakan hanya di testnet.
contract LPAnchor {
    struct Anchor { bytes32 dataHash; uint64 ts; }
    address public immutable owner;
    mapping(bytes32 => Anchor) public anchors;
    event Anchored(bytes32 indexed eventKey, bytes32 dataHash, uint64 ts);

    constructor() { owner = msg.sender; }

    function anchor(bytes32 eventKey, bytes32 dataHash) external {
        require(msg.sender == owner, "bukan pemilik");
        require(anchors[eventKey].ts == 0, "sudah di-anchor");
        require(dataHash != bytes32(0), "hash kosong");
        anchors[eventKey] = Anchor(dataHash, uint64(block.timestamp));
        emit Anchored(eventKey, dataHash, uint64(block.timestamp));
    }
}
