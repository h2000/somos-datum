import assert from "assert";
import anchor from "@project-serum/anchor";
import {provider, program, createUser, programForUser, user02, program02, user03, program03} from "./util.js";

describe("somos-solana", () => {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // PURCHASE (PRIMARY) //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // derive pda key
    let ledgerSeed = Buffer.from("hancockhancockha");
    let pdaLedgerPublicKey, _;
    before(async () => {
        [pdaLedgerPublicKey, _] =
            await anchor.web3.PublicKey.findProgramAddress(
                [ledgerSeed],
                program.programId
            );
    });
    // init
    it("initializes ledger", async () => {
        const price = 0.1 * anchor.web3.LAMPORTS_PER_SOL
        await program.rpc.initializeLedger(ledgerSeed, new anchor.BN(3), new anchor.BN(price), 0.10, {
            accounts: {
                user: provider.wallet.publicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        let actualLedger = await program.account.ledger.fetch(
            pdaLedgerPublicKey
        );
        console.log(actualLedger)
        let balance = await provider.connection.getBalance(provider.wallet.publicKey);
        console.log(balance);
        // assertions
        assert.ok(actualLedger.originalSupplyRemaining === 3)
    });
    // purchase primary
    it("purchase primary", async () => {
        let balance = await provider.connection.getBalance(provider.wallet.publicKey)
        await program03.rpc.purchasePrimary({
            accounts: {
                user: user03.key.publicKey,
                boss: provider.wallet.publicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        let actualLedger = await program03.account.ledger.fetch(
            pdaLedgerPublicKey
        );
        console.log(actualLedger)
        const newBalance = await provider.connection.getBalance(provider.wallet.publicKey);
        const diff = newBalance - balance
        console.log(diff)
        console.log(newBalance)
        console.log(balance)
        // assertions
        assert.ok(actualLedger.originalSupplyRemaining === 2)
        assert.ok(diff === 100000000)
    });
    // purchase primary sold out
    it("purchase primary sold out", async () => {
        let balance = await provider.connection.getBalance(provider.wallet.publicKey)
        await program02.rpc.purchasePrimary({
            accounts: {
                user: user02.key.publicKey,
                boss: provider.wallet.publicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        await program02.rpc.purchasePrimary({
            accounts: {
                user: user02.key.publicKey,
                boss: provider.wallet.publicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        let actualLedger = await program02.account.ledger.fetch(
            pdaLedgerPublicKey
        );
        console.log(actualLedger)
        const newBalance = await provider.connection.getBalance(provider.wallet.publicKey);
        const diff = newBalance - balance
        console.log(diff)
        console.log(newBalance)
        console.log(balance)
        // assertions
        assert.ok(actualLedger.originalSupplyRemaining === 0)
        assert.ok(diff === 200000000)
    });
    // throw error on sold out purchase
    it("purchase primary sold out throws error", async () => {
        let purchaser = await createUser();
        let _program = programForUser(purchaser)
        try {
            await _program.rpc.purchasePrimary({
                accounts: {
                    user: purchaser.key.publicKey,
                    boss: provider.wallet.publicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6000)
            console.log(error)
        }
    });
    // failed purchase primary
    it("purchase primary failed without boss", async () => {
        let purchaser = await createUser();
        let _program = programForUser(purchaser)
        try {
            await _program.rpc.purchasePrimary({
                accounts: {
                    user: purchaser.key.publicKey,
                    boss: purchaser.key.publicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6001)
            console.log(error)
        }
    });
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // ESCROW //////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // derive pda key
    let escrowSeed = Buffer.from("grovergrovergrov");
    let pdaEscrowPublicKey, __;
    before(async () => {
        [pdaEscrowPublicKey, __] =
            await anchor.web3.PublicKey.findProgramAddress(
                [escrowSeed],
                program.programId
            );
    });
    // init
    it("initializes escrow", async () => {
        await program.rpc.initializeEscrow(escrowSeed, {
            accounts: {
                user: provider.wallet.publicKey,
                escrow: pdaEscrowPublicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        let actualEscrow = await program.account.escrow.fetch(
            pdaEscrowPublicKey
        );
        let actualLedger = await program.account.ledger.fetch(
            pdaLedgerPublicKey
        );
        console.log(actualEscrow)
        console.log(actualLedger)
        // assertions
        assert.ok(actualEscrow.items.length === 0)
        assert.ok(actualEscrow.boss.toString() === actualLedger.boss.toString())
    });
    // submit
    it("submit to escrow", async () => {
        const price = 0.25 * anchor.web3.LAMPORTS_PER_SOL
        await program02.rpc.submitToEscrow(new anchor.BN(price), {
            accounts: {
                seller: user02.key.publicKey,
                escrow: pdaEscrowPublicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        let actualEscrow = await program.account.escrow.fetch(
            pdaEscrowPublicKey
        );
        console.log(actualEscrow)
        // assertions
        assert.ok(actualEscrow.items.length === 1)
    });
    // submit
    it("submit to escrow failed without ledger ownership", async () => {
        let seller = await createUser();
        let _program = programForUser(seller)
        const price = 0.25 * anchor.web3.LAMPORTS_PER_SOL
        try {
            await _program.rpc.submitToEscrow(new anchor.BN(price), {
                accounts: {
                    seller: seller.key.publicKey,
                    escrow: pdaEscrowPublicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6002)
            console.log(error);
        }
        let actualEscrow = await _program.account.escrow.fetch(
            pdaEscrowPublicKey
        );
        // assertions
        assert.ok(actualEscrow.items.length === 1)
    });
    // purchase secondary
    it("fail on purchase secondary when item is not on escrow", async () => {
        const buyer = await createUser();
        const _program = programForUser(buyer)
        const seller = user03.key.publicKey; // user03 never submitted for escrow
        const boss = provider.wallet.publicKey;
        const price = 0.25 * anchor.web3.LAMPORTS_PER_SOL;
        const escrowItem = {price: new anchor.BN(price), seller: seller};
        try {
            await _program.rpc.purchaseSecondary(escrowItem, {
                accounts: {
                    buyer: buyer.key.publicKey,
                    seller: seller,
                    boss: boss,
                    escrow: pdaEscrowPublicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6003)
            console.log(error);
        }
    });
    // purchase secondary
    it("fail on purchase secondary when item is on escrow but specified seller does not match", async () => {
        const buyer = await createUser();
        const _program = programForUser(buyer)
        const seller = user02.key.publicKey;
        const boss = provider.wallet.publicKey;
        const price = 0.25 * anchor.web3.LAMPORTS_PER_SOL;
        const escrowItem = {price: new anchor.BN(price), seller: seller};
        try {
            await _program.rpc.purchaseSecondary(escrowItem, {
                accounts: {
                    buyer: buyer.key.publicKey,
                    seller: boss, // should be user02 (seller)
                    boss: boss,
                    escrow: pdaEscrowPublicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6004)
            console.log(error);
        }
    });
    // purchase secondary
    it("purchase secondary at listed price", async () => {
        // players
        const buyer = await createUser();
        const _program = programForUser(buyer);
        const seller = user02.key.publicKey;
        const boss = provider.wallet.publicKey;
        // balances
        let balanceSeller = await provider.connection.getBalance(seller);
        let balanceBoss = await provider.connection.getBalance(boss);
        // items
        const price1 = 0.20 * anchor.web3.LAMPORTS_PER_SOL;
        const price2 = 0.25 * anchor.web3.LAMPORTS_PER_SOL;
        const escrowItem1 = {price: new anchor.BN(price1), seller: seller}; // seller is valid but price is invalid
        const escrowItem2 = {price: new anchor.BN(price2), seller: seller};
        // failure at wrong price
        try {
            await _program.rpc.purchaseSecondary(escrowItem1, {
                accounts: {
                    buyer: buyer.key.publicKey,
                    seller: seller,
                    boss: boss,
                    escrow: pdaEscrowPublicKey,
                    ledger: pdaLedgerPublicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                }
            });
        } catch (error) {
            assert.ok(error.code === 6003)
            console.log(error);
        }
        // success at correct price
        await _program.rpc.purchaseSecondary(escrowItem2, {
            accounts: {
                buyer: buyer.key.publicKey,
                seller: seller,
                boss: boss,
                escrow: pdaEscrowPublicKey,
                ledger: pdaLedgerPublicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            }
        });
        // PDAs
        const actualEscrow = await program.account.escrow.fetch(
            pdaEscrowPublicKey
        );
        console.log(actualEscrow)
        const actualLedger = await program.account.ledger.fetch(
            pdaLedgerPublicKey
        )
        console.log(actualLedger)
        // balances
        // balances
        let newBalanceBuyer = await provider.connection.getBalance(buyer.key.publicKey);
        let newBalanceSeller = await provider.connection.getBalance(seller);
        let newBalanceBoss = await provider.connection.getBalance(boss);
        // assertions
        assert.ok(actualEscrow.items.length === 0)
        const owners = actualLedger.owners.map(_publicKey => _publicKey.toString())
        assert.ok(owners.includes(buyer.key.publicKey.toString()))
        assert.ok(owners.filter(pk => pk === seller.toString()).length === 1) // used to have ownership of 2
        assert.ok(newBalanceSeller - balanceSeller === 225000000)
        assert.ok(newBalanceBoss - balanceBoss === 25000000)
    });
});
