// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SupplyChainProvenance
 * @dev Immutable on-chain provenance tracking and custody handoff verification.
 * Enforces cold-chain temperature invariants and authorized cryptographic handoffs.
 */
contract SupplyChainProvenance {
    enum BatchStatus {
        MANUFACTURED,
        QUALITY_APPROVED,
        IN_TRANSIT,
        CUSTOMS_CLEARED,
        DELIVERED,
        COMPROMISED
    }

    struct CustodyTransfer {
        address fromCustodian;
        address toCustodian;
        uint256 timestamp;
        string location;
        int256 recordedTempCelsius;
        string proofHash;
    }

    struct Batch {
        string batchId;
        string productName;
        string sku;
        string originLocation;
        uint256 productionTimestamp;
        address manufacturer;
        address currentCustodian;
        BatchStatus status;
        bool isColdChain;
        int256 minTempCelsius;
        int256 maxTempCelsius;
        bool isCompromised;
        string compromiseReason;
    }

    mapping(string => Batch) public batches;
    mapping(string => CustodyTransfer[]) private batchTransfers;
    string[] public registeredBatchIds;

    event BatchRegistered(string indexed batchId, string productName, address indexed manufacturer);
    event CustodyTransferred(string indexed batchId, address indexed fromCustodian, address indexed toCustodian, string location);
    event TelematicsLogged(string indexed batchId, int256 tempCelsius, string location);
    event ColdChainCompromised(string indexed batchId, int256 recordedTemp, string reason);
    event BatchDelivered(string indexed batchId, address indexed recipient);

    function registerBatch(
        string calldata _batchId,
        string calldata _productName,
        string calldata _sku,
        string calldata _originLocation,
        bool _isColdChain,
        int256 _minTempCelsius,
        int256 _maxTempCelsius
    ) external {
        require(bytes(_batchId).length > 0, "Batch ID cannot be empty");
        require(batches[_batchId].productionTimestamp == 0, "Batch ID already registered");

        batches[_batchId] = Batch({
            batchId: _batchId,
            productName: _productName,
            sku: _sku,
            originLocation: _originLocation,
            productionTimestamp: block.timestamp,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            status: BatchStatus.MANUFACTURED,
            isColdChain: _isColdChain,
            minTempCelsius: _minTempCelsius,
            maxTempCelsius: _maxTempCelsius,
            isCompromised: false,
            compromiseReason: ""
        });

        registeredBatchIds.push(_batchId);
        emit BatchRegistered(_batchId, _productName, msg.sender);
    }

    function transferCustody(
        string calldata _batchId,
        address _nextCustodian,
        string calldata _location,
        int256 _recordedTempCelsius,
        string calldata _proofHash
    ) external {
        Batch storage b = batches[_batchId];
        require(b.productionTimestamp > 0, "Batch does not exist");
        require(msg.sender == b.currentCustodian, "Only current custodian can authorize transfer");
        require(_nextCustodian != address(0), "Invalid recipient custodian");
        require(b.status != BatchStatus.DELIVERED, "Batch already finalized and delivered");

        // Verify cold chain invariants
        if (b.isColdChain && (_recordedTempCelsius < b.minTempCelsius || _recordedTempCelsius > b.maxTempCelsius)) {
            b.isCompromised = true;
            b.status = BatchStatus.COMPROMISED;
            b.compromiseReason = "Temperature excursion during custody handover";
            emit ColdChainCompromised(_batchId, _recordedTempCelsius, b.compromiseReason);
        }

        address previousCustodian = b.currentCustodian;
        b.currentCustodian = _nextCustodian;
        if (!b.isCompromised) {
            b.status = BatchStatus.IN_TRANSIT;
        }

        batchTransfers[_batchId].push(CustodyTransfer({
            fromCustodian: previousCustodian,
            toCustodian: _nextCustodian,
            timestamp: block.timestamp,
            location: _location,
            recordedTempCelsius: _recordedTempCelsius,
            proofHash: _proofHash
        }));

        emit CustodyTransferred(_batchId, previousCustodian, _nextCustodian, _location);
    }

    function recordTelematics(
        string calldata _batchId,
        int256 _tempCelsius,
        string calldata _location
    ) external {
        Batch storage b = batches[_batchId];
        require(b.productionTimestamp > 0, "Batch does not exist");
        require(msg.sender == b.currentCustodian, "Only current custodian can log telematics");

        if (b.isColdChain && (_tempCelsius < b.minTempCelsius || _tempCelsius > b.maxTempCelsius)) {
            b.isCompromised = true;
            b.status = BatchStatus.COMPROMISED;
            b.compromiseReason = "In-transit telemetry breached safe thermal boundaries";
            emit ColdChainCompromised(_batchId, _tempCelsius, b.compromiseReason);
        }

        emit TelematicsLogged(_batchId, _tempCelsius, _location);
    }

    function getTransfersCount(string calldata _batchId) external view returns (uint256) {
        return batchTransfers[_batchId].length;
    }

    function getTransfer(string calldata _batchId, uint256 index) external view returns (CustodyTransfer memory) {
        require(index < batchTransfers[_batchId].length, "Index out of range");
        return batchTransfers[_batchId][index];
    }
}
