# Platega SDK for NestJS

**English** | [Русский](./README.ru.md)

![npm version](https://img.shields.io/npm/v/@tsforge7/platega-sdk-nestjs)
![Downloads](https://img.shields.io/npm/dt/@tsforge7/platega-sdk-nestjs)
![License](https://img.shields.io/npm/l/@tsforge7/platega-sdk-nestjs)
![Build Status](https://img.shields.io/github/actions/workflow/status/tsforge/platega-sdk-nestjs/deploy-lib.yml)
![Types](https://img.shields.io/npm/types/@tsforge7/platega-sdk-nestjs)
![Node](https://img.shields.io/node/v/@tsforge7/platega-sdk-nestjs)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/@tsforge7/platega-sdk-nestjs)
![Last Update](https://img.shields.io/npm/last-update/@tsforge7/platega-sdk-nestjs)

NestJS module for the [Platega](https://platega.io) payment system: accept payments (SBP, cards, ERIP, crypto), check statuses, cancel transactions, pay out to cards and verify callbacks.

This is a wrapper around [@tsforge7/platega-sdk](https://github.com/tsforge/platega-sdk) — it registers a ready-to-use `Platega` instance in the NestJS DI container and provides the `@InjectPlatega()` decorator for injecting it into your services.

📖 [Official Platega documentation](https://docs.platega.io) · [SDK documentation](https://github.com/tsforge/platega-sdk)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Configuration](#configuration)
    - [Synchronous — `forRoot()`](#synchronous--forroot)
    - [Asynchronous — `forRootAsync()`](#asynchronous--forrootasync)
- [What the SDK can do](#what-the-sdk-can-do)
- [Examples](#examples)
    - [Service](#service)
    - [CQRS handler](#cqrs-handler)
    - [Callbacks](#callbacks)
- [Error handling](#error-handling)
- [Module API](#module-api)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @tsforge7/platega-sdk-nestjs @tsforge7/platega-sdk
```

## Quick start

**1. Import the module** — it is global, a single import in `AppModule` is enough:

```typescript
import { Module } from '@nestjs/common';
import { PlategaNestjsModule } from '@tsforge7/platega-sdk-nestjs';

@Module({
    imports: [
        PlategaNestjsModule.forRoot({
            merchantId: process.env.PLATEGA_MERCHANT_ID!,
            secret: process.env.PLATEGA_SECRET!,
        }),
    ],
})
export class AppModule {}
```

**2. Inject the SDK and create a payment:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPlatega } from '@tsforge7/platega-sdk-nestjs';
import { Platega } from '@tsforge7/platega-sdk';

@Injectable()
export class PaymentService {
    constructor(@InjectPlatega() private readonly platega: Platega) {}

    public async createPaymentLink(amount: number, orderId: string) {
        const payment = await this.platega.payments.createLink({
            paymentDetails: { amount, currency: 'RUB' },
            description: `Order #${orderId}`,
            return: 'https://myshop.com/success',
            failedUrl: 'https://myshop.com/fail',
            payload: orderId, // comes back in the callback
        });

        // payment.url — redirect the customer to this link
        // payment.transactionId — store it, the callback references it
        return payment;
    }
}
```

**3. Next:** the customer pays → Platega sends a [callback](#callbacks) → you credit the order.

## Configuration

| Parameter    | Required | Description                                      |
| ------------ | -------- | ------------------------------------------------ |
| `merchantId` | yes      | `X-MerchantId` — your shop ID from the dashboard |
| `secret`     | yes      | `X-Secret` — secret API key                      |
| `baseUrl`    | no       | API URL, defaults to `https://app.platega.io`    |

Both keys are provided by your Platega manager during onboarding and are also available in the dashboard on the **"Settings"** page. The config is validated at application startup: a missing key fails immediately with a clear error, not on the first request.

> ⚠️ **Never commit keys to git.** Keep them in environment variables — anyone who knows your `X-Secret` can make requests on your behalf.

### Synchronous — `forRoot()`

Use it when the keys are available at module load time:

```typescript
PlategaNestjsModule.forRoot({
    merchantId: process.env.PLATEGA_MERCHANT_ID!,
    secret: process.env.PLATEGA_SECRET!,
});
```

### Asynchronous — `forRootAsync()`

Use it when the keys come from `ConfigService` or another provider:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlategaNestjsModule, IPlategaModuleOptions } from '@tsforge7/platega-sdk-nestjs';

@Module({
    imports: [
        PlategaNestjsModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService): IPlategaModuleOptions => ({
                merchantId: config.getOrThrow('PLATEGA_MERCHANT_ID'),
                secret: config.getOrThrow('PLATEGA_SECRET'),
            }),
            inject: [ConfigService],
        }),
    ],
})
export class AppModule {}
```

## What the SDK can do

The injected `Platega` instance gives access to all SDK modules:

| What you need to do                           | Method                                   |
| --------------------------------------------- | ---------------------------------------- |
| Payment with a specific method (SBP, card...) | `platega.payments.create()`              |
| Payment link (payer chooses the method)       | `platega.payments.createLink()`          |
| Payment status                                | `platega.payments.getById()`             |
| Balances for all currencies                   | `platega.balances.getAll()`              |
| Conversion history                            | `platega.conversions.list()`             |
| Check whether a transaction can be cancelled  | `platega.refunds.checkCancelSupported()` |
| Cancel a transaction (refund)                 | `platega.refunds.cancel()`               |
| Pay out to a RUB card                         | `platega.withdrawals.createCardRub()`    |
| Saved cards for payouts                       | `platega.withdrawals.getSavedCards()`    |
| Verify callback authenticity                  | `platega.verifyCallback()`               |

Constants (`PAYMENT_METHOD`, `PAYMENT_STATUS`, `CALLBACK_STATUS`...), zod schemas and all request/response types are exported from the root of `@tsforge7/platega-sdk` — no deep imports needed. Full reference — in the [SDK documentation](https://github.com/tsforge/platega-sdk).

## Examples

### Service

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPlatega } from '@tsforge7/platega-sdk-nestjs';
import { Platega, PAYMENT_METHOD } from '@tsforge7/platega-sdk';

@Injectable()
export class PaymentService {
    constructor(@InjectPlatega() private readonly platega: Platega) {}

    // SBP payment (method chosen upfront)
    public async createSbpPayment(amount: number, orderId: string, userId: string) {
        return this.platega.payments.create({
            paymentMethod: PAYMENT_METHOD.SBP,
            paymentDetails: { amount, currency: 'RUB' },
            description: `Order #${orderId}`,
            return: 'https://myshop.com/success',
            failedUrl: 'https://myshop.com/fail',
            payload: orderId,
            metadata: { userId }, // payer ID in your system — needed for antifraud
        });
    }

    // Status check
    public async getStatus(transactionId: string) {
        const tx = await this.platega.payments.getById(transactionId);
        return tx.status; // 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'CHARGEBACKED'
    }
}
```

### CQRS handler

Example for projects using `@nestjs/cqrs`. The response type comes straight from the SDK — `CreatePaymentLinkV2Command.ICreatePaymentLinkV2Response`:

```typescript
// create-payment-link.command.ts
export class CreatePaymentLinkCommand {
    constructor(
        public readonly amount: number,
        public readonly uuid: string,
        public readonly userUuid: string,
    ) {}
}
```

```typescript
// create-payment-link.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import { Platega, CreatePaymentLinkV2Command } from '@tsforge7/platega-sdk';
import { InjectPlatega } from '@tsforge7/platega-sdk-nestjs';
import { CreatePaymentLinkCommand } from './create-payment-link.command';
import { ICommandResponse } from '@common/types/command-response.type';
import { ERRORS } from '@libs/contracts/constants';

type TResponse = ICommandResponse<CreatePaymentLinkV2Command.ICreatePaymentLinkV2Response>;

@CommandHandler(CreatePaymentLinkCommand)
export class CreatePaymentLinkHandler implements ICommandHandler<
    CreatePaymentLinkCommand,
    TResponse
> {
    public readonly logger = new Logger(CreatePaymentLinkHandler.name);

    constructor(@InjectPlatega() private readonly platega: Platega) {}

    public async execute(command: CreatePaymentLinkCommand): Promise<TResponse> {
        try {
            const { amount, uuid, userUuid } = command;

            const payment = await this.platega.payments.createLink({
                paymentDetails: { amount, currency: 'RUB' },
                description: `Order #${uuid}`,
                return: 'https://myshop.com/success',
                failedUrl: 'https://myshop.com/fail',
                payload: uuid, // comes back in the callback
                metadata: { userId: userUuid },
            });

            return {
                isSuccess: true,
                data: payment, // payment.url, payment.transactionId
            };
        } catch (error: unknown) {
            // Invalid params — the SDK rejected the request BEFORE sending (amount, required fields...)
            if (error instanceof ZodError) {
                this.logger.error(
                    `[CreatePaymentLinkHandler] Invalid payment params: ${JSON.stringify(error.issues)}`,
                );
                return {
                    isSuccess: false,
                    ...ERRORS.CREATE_PAYMENT_LINK_INVALID_PARAMS,
                };
            }

            // Platega API error: 'Platega API error <status>: <response body>'
            if (error instanceof Error) {
                this.logger.error(`[CreatePaymentLinkHandler] Platega API error: ${error.message}`);
                return {
                    isSuccess: false,
                    ...ERRORS.CREATE_PAYMENT_LINK_FAILED,
                };
            }

            this.logger.error(`[CreatePaymentLinkHandler] Unknown error: ${JSON.stringify(error)}`);
            return {
                isSuccess: false,
                ...ERRORS.INTERNAL_SERVER_ERROR,
            };
        }
    }
}
```

### Callbacks

When a transaction status changes, Platega sends a **POST** to your URL (set it in the dashboard: Settings → Callback URLs). Callbacks have no cryptographic signature — instead, the request carries your `X-MerchantId` and `X-Secret` headers, which the SDK compares with your config using a timing-safe comparison:

```typescript
import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectPlatega } from '@tsforge7/platega-sdk-nestjs';
import { Platega, TransactionCallbackCommand } from '@tsforge7/platega-sdk';

@Controller('platega')
export class PlategaCallbackController {
    constructor(@InjectPlatega() private readonly platega: Platega) {}

    @Post('callback')
    public async handleCallback(@Req() req: Request, @Res() res: Response) {
        // 1. Is it really Platega? (header comparison)
        if (!this.platega.verifyCallback(req.headers)) {
            return res.status(HttpStatus.UNAUTHORIZED).end();
        }

        // 2. Parse the body: { id, amount, currency, status, paymentMethod, payload? }
        const cb = TransactionCallbackCommand.TransactionCallbackSchema.parse(req.body);

        // 3. Don't take the callback at its word — re-check the status via the API
        const tx = await this.platega.payments.getById(cb.id);

        if (tx.status === 'CONFIRMED') {
            // 4. Verify the amount/currency against the order and credit it (idempotently —
            //    Platega retries the callback up to 3 times, the order must not be credited twice)
        }

        // 5. Respond with 200, otherwise Platega will retry
        return res.status(HttpStatus.OK).end();
    }
}
```

Callback statuses: `CONFIRMED` — paid, `CANCELED` — declined, `CHARGEBACKED` — funds returned. `PENDING` never arrives in a callback.

## Error handling

The SDK throws errors in two cases:

```typescript
import { ZodError } from 'zod';

try {
    await this.platega.payments.createLink({/* ... */});
} catch (error) {
    if (error instanceof ZodError) {
        // 1. Validation error BEFORE the request is sent — invalid parameters
        console.log(error.issues);
    } else if (error instanceof Error) {
        // 2. Platega API error — non-2xx response
        //    Format: 'Platega API error <status>: <response body>'
        console.log(error.message);
    }
}
```

| API status | Meaning                              |
| ---------- | ------------------------------------ |
| 400        | Validation error on the Platega side |
| 401        | Invalid `merchantId`/`secret`        |
| 404        | Transaction not found                |

## Module API

| Export                                   | Description                                                      |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `PlategaNestjsModule.forRoot(options)`   | Synchronous configuration                                        |
| `PlategaNestjsModule.forRootAsync(opts)` | Asynchronous configuration (`useFactory` / `imports` / `inject`) |
| `@InjectPlatega()`                       | Decorator that injects the `Platega` instance                    |
| `IPlategaModuleOptions`                  | Module options type (`merchantId`, `secret`, `baseUrl?`)         |

The module is marked `@Global()` — import it once in the root module, after that `@InjectPlatega()` works anywhere in the application without re-imports.

## Requirements

- Node.js 18+ (the SDK uses the built-in `fetch`)
- NestJS 10+
- TypeScript 5.0+

## Contributing

**Found a bug?** Open an [Issue](https://github.com/tsforge/platega-sdk-nestjs/issues/new) — describe what you did, what you expected and what you got (error code, module, SDK and Node versions). Please never include your `X-MerchantId`/`X-Secret` or real transaction data in an issue.

**Want to propose a change?** Direct pushes to the repository are not allowed — changes are accepted via a Merge Request from a fork:

1. **Fork** the repository — the "Fork" button on the [tsforge/platega-sdk-nestjs](https://github.com/tsforge/platega-sdk-nestjs) page.
2. **Clone your fork** and create a branch:

    ```bash
    git clone git@github.com:<your-login>/platega-sdk-nestjs.git
    cd platega-sdk-nestjs
    npm install
    git checkout -b fix/my-fix
    ```

3. **Make your changes** and make sure everything is green:

    ```bash
    npm run lint      # linter
    npm run build     # build
    npm run format    # prettier
    ```

    Keep code comments in English.

4. **Push the branch to your fork** and open a Merge Request into `main` of the upstream repository. Describe what you changed and why; if the MR closes an issue, reference it (`Closes #N`).

## License

ISC © [tsforge](https://github.com/tsforge)
