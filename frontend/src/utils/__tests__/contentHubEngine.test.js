/**
 * yieldToMainThread 单元测试
 * 
 * 核心验证：
 * 1. 返回 Promise
 * 2. 确实让出主线程（允许其他 setTimeout 任务在 await 之间执行）
 * 3. 多次调用不会产生副作用
 */

import { yieldToMainThread, generateAllAsync } from '../contentHubEngine.js';

describe('yieldToMainThread', () => {

  test('应该返回一个 Promise', () => {
    const result = yieldToMainThread();
    expect(result).toBeInstanceOf(Promise);
  });

  test('应该在 await 后让出主线程，允许其他宏任务执行', async () => {
    let flag = false;

    // 安排一个 setTimeout（宏任务），在 yield 后应该被执行
    setTimeout(() => {
      flag = true;
    }, 0);

    // 此时 flag 应该还是 false（setTimeout 还没执行）
    expect(flag).toBe(false);

    // 让出主线程
    await yieldToMainThread();

    // 此时 flag 应该是 true（setTimeout 已经被执行了）
    expect(flag).toBe(true);
  });

  test('应该让出主线程，让后续同步代码在 await 之前继续执行', async () => {
    const order = [];

    order.push('1-before-settimeout');

    setTimeout(() => {
      order.push('2-settimeout-callback');
    }, 0);

    order.push('3-before-yield');

    await yieldToMainThread();

    order.push('4-after-yield');

    // 验证执行顺序
    expect(order).toEqual([
      '1-before-settimeout',
      '3-before-yield',
      '2-settimeout-callback',  // ← 这个应该在 yield 之后、await 之前执行
      '4-after-yield'
    ]);
  });

  test('连续多次调用应该正常工作', async () => {
    let count = 0;

    const increment = () => { count++; };

    setTimeout(increment, 0);
    setTimeout(increment, 0);

    await yieldToMainThread();
    expect(count).toBe(2);

    setTimeout(increment, 0);
    await yieldToMainThread();
    expect(count).toBe(3);
  });

  test('没有让出主线程的对照测试（验证测试方法有效）', async () => {
    let flag = false;

    setTimeout(() => {
      flag = true;
    }, 0);

    // 不 await，直接检查（此时 setTimeout 还没执行）
    expect(flag).toBe(false);

    // 用一个微任务来验证
    await Promise.resolve();
    // 注意：Promise.resolve() 是微任务，setTimeout 是宏任务
    // 微任务不会让宏任务执行，所以 flag 还是 false
    // 这证明了 yieldToMainThread（用 setTimeout）确实让出了主线程
    expect(flag).toBe(false);
  });
});

describe('generateAllAsync', () => {

  test('应该返回 Promise', () => {
    const result = generateAllAsync();
    expect(result).toBeInstanceOf(Promise);
  });

  test('应该在每批后让出主线程，允许进度回调被调用', async () => {
    const progressCalls = [];

    const units = await generateAllAsync({
      batchSize: 20,  // 用更大的批大小减少调用次数
      onProgress: (processed, total) => {
        progressCalls.push({ processed, total });
      }
    });

    // 应该生成了 80 个单元
    expect(units.length).toBeGreaterThan(0);

    // 应该有进度回调
    expect(progressCalls.length).toBeGreaterThan(0);

    // 最后一次进度应该是 100%
    const lastCall = progressCalls[progressCalls.length - 1];
    expect(lastCall.processed).toBe(lastCall.total);
  });

  test('应该按正确顺序调用进度回调', async () => {
    const progressValues = [];

    await generateAllAsync({
      batchSize: 40,
      onProgress: (processed) => {
        progressValues.push(processed);
      }
    });

    // 进度值应该是不递减的（最后可能会有两次相同的 total 值）
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
    // 第一个值应该大于 0
    expect(progressValues[0]).toBeGreaterThan(0);
    // 最后一个值应该是总数
    expect(progressValues[progressValues.length - 1]).toBe(80);
  });
});
