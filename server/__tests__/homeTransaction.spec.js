const STATE = {
  WaitingSellerSignature: 0,
  WaitingBuyerSignature: 1,
  WaitingRealtorReview: 2,
  WaitingFinalization: 3,
  Finalized: 4,
  Rejected: 5,
};

const DEPOSIT_PCT = 10;
const DEADLINE = 5 * 60;

function deploy({ price, realtorFee, realtor, seller, buyer, now = 0 }) {
  if (price < realtorFee) throw new Error('Price needs to be more than realtor fee!');
  if ((price * DEPOSIT_PCT) / 100 < realtorFee) {
    throw new Error('Minimum deposit must cover realtor fee');
  }

  const balances = { [realtor]: 0, [seller]: 0, [buyer]: 0 };
  let state = STATE.WaitingSellerSignature;
  let deposit = 0;
  let deadline = 0;
  let clock = now;

  return {
    balances,
    getState: () => state,
    tick: (s) => { clock += s; },

    sellerSign(from) {
      if (from !== seller) throw new Error('Only seller can sign contract');
      if (state !== STATE.WaitingSellerSignature) throw new Error('Wrong contract state');
      state = STATE.WaitingBuyerSignature;
    },

    buyerSign(from, value) {
      if (from !== buyer) throw new Error('Only buyer can sign contract');
      if (state !== STATE.WaitingBuyerSignature) throw new Error('Wrong contract state');
      const min = (price * DEPOSIT_PCT) / 100;
      if (value < min || value > price) {
        throw new Error('Buyer needs to deposit between 10% and 100% to sign contract');
      }
      state = STATE.WaitingRealtorReview;
      deposit = value;
      deadline = clock + DEADLINE;
    },

    realtorReview(from, accepted) {
      if (from !== realtor) throw new Error('Only realtor can review closing conditions');
      if (state !== STATE.WaitingRealtorReview) throw new Error('Wrong contract state');
      if (accepted) {
        state = STATE.WaitingFinalization;
      } else {
        state = STATE.Rejected;
        balances[buyer] += deposit;
      }
    },

    buyerFinalize(from, value) {
      if (from !== buyer) throw new Error('Only buyer can finalize transaction');
      if (state !== STATE.WaitingFinalization) throw new Error('Wrong contract state');
      if (clock > deadline) throw new Error('Finalization deadline has passed');
      if (value + deposit !== price) {
        throw new Error('Buyer needs to pay the rest of the cost to finalize transaction');
      }
      state = STATE.Finalized;
      balances[seller] += price - realtorFee;
      balances[realtor] += realtorFee;
    },

    anyWithdraw(from) {
      if (from !== buyer && deadline > clock) {
        throw new Error('Only buyer can withdraw before transaction deadline');
      }
      if (state !== STATE.WaitingFinalization) throw new Error('Wrong contract state');
      state = STATE.Rejected;
      balances[seller] += deposit - realtorFee;
      balances[realtor] += realtorFee;
    },
  };
}

const R = 'realtor', S = 'seller', B = 'buyer', X = 'stranger';

describe('HomeTransaction', () => {
  test('completes full transaction and pays seller and realtor', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    c.buyerSign(B, 100);
    c.realtorReview(R, true);
    c.buyerFinalize(B, 900);

    expect(c.getState()).toBe(STATE.Finalized);
    expect(c.balances[S]).toBe(950);
    expect(c.balances[R]).toBe(50);
  });

  test('refunds buyer when realtor rejects', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    c.buyerSign(B, 200);
    c.realtorReview(R, false);

    expect(c.getState()).toBe(STATE.Rejected);
    expect(c.balances[B]).toBe(200);
  });

  test('rejects sign attempt from wrong role', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    expect(() => c.sellerSign(B)).toThrow('Only seller');
  });

  test('rejects deposit under 10%', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    expect(() => c.buyerSign(B, 50)).toThrow(/10%/);
  });

  test('rejects finalize after the deadline', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    c.buyerSign(B, 100);
    c.realtorReview(R, true);
    c.tick(DEADLINE + 1);
    expect(() => c.buyerFinalize(B, 900)).toThrow(/deadline/);
  });

  test('only buyer can withdraw before deadline', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    c.buyerSign(B, 100);
    c.realtorReview(R, true);
    expect(() => c.anyWithdraw(X)).toThrow(/before transaction deadline/);
  });

  test('anyone can withdraw after the deadline and seller is paid out', () => {
    const c = deploy({ price: 1000, realtorFee: 50, realtor: R, seller: S, buyer: B });
    c.sellerSign(S);
    c.buyerSign(B, 100);
    c.realtorReview(R, true);
    c.tick(DEADLINE + 1);
    c.anyWithdraw(X);

    expect(c.getState()).toBe(STATE.Rejected);
    expect(c.balances[S]).toBe(50);
    expect(c.balances[R]).toBe(50);
  });

  test('refuses deploy when realtor fee exceeds minimum deposit', () => {
    expect(() => deploy({ price: 1000, realtorFee: 200, realtor: R, seller: S, buyer: B }))
      .toThrow(/Minimum deposit/);
  });
});