# Platega SDK для NestJS

[English](./README.md) | **Русский**

![npm version](https://img.shields.io/npm/v/@tsforge7/platega-sdk-nestjs)
![Downloads](https://img.shields.io/npm/dt/@tsforge7/platega-sdk-nestjs)
![License](https://img.shields.io/npm/l/@tsforge7/platega-sdk-nestjs)
![Build Status](https://img.shields.io/github/actions/workflow/status/tsforge/platega-sdk-nestjs/deploy-lib.yml)
![Types](https://img.shields.io/npm/types/@tsforge7/platega-sdk-nestjs)
![Node](https://img.shields.io/node/v/@tsforge7/platega-sdk-nestjs)
![npm unpacked size](https://img.shields.io/npm/unpacked-size/@tsforge7/platega-sdk-nestjs)
![Last Update](https://img.shields.io/npm/last-update/@tsforge7/platega-sdk-nestjs)

NestJS-модуль для платёжной системы [Platega](https://platega.io): приём платежей (СБП, карты, ЕРИП, крипта), проверка статусов, возвраты, выплаты на карты и проверка колбэков.

Это обёртка над [@tsforge7/platega-sdk](https://github.com/tsforge/platega-sdk) — она регистрирует готовый экземпляр `Platega` в DI-контейнере NestJS и даёт декоратор `@InjectPlatega()` для внедрения в сервисы.

📖 [Официальная документация Platega](https://docs.platega.io) · [Документация SDK](https://github.com/tsforge/platega-sdk)

---

## Оглавление

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Конфигурация](#конфигурация)
    - [Синхронная — `forRoot()`](#синхронная--forroot)
    - [Асинхронная — `forRootAsync()`](#асинхронная--forrootasync)
- [Что умеет SDK](#что-умеет-sdk)
- [Примеры](#примеры)
    - [Сервис](#сервис)
    - [CQRS-хендлер](#cqrs-хендлер)
    - [Колбэки](#колбэки)
- [Обработка ошибок](#обработка-ошибок)
- [API модуля](#api-модуля)
- [Требования](#требования)
- [Как внести изменения](#как-внести-изменения)
- [Лицензия](#лицензия)

---

## Установка

```bash
npm install @tsforge7/platega-sdk-nestjs @tsforge7/platega-sdk
```

## Быстрый старт

**1. Подключите модуль** — он глобальный, достаточно одного импорта в `AppModule`:

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

**2. Внедрите SDK и создайте платёж:**

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
            description: `Заказ #${orderId}`,
            return: 'https://myshop.com/success',
            failedUrl: 'https://myshop.com/fail',
            payload: orderId, // вернётся в колбэке
        });

        // payment.url — отправьте покупателя по этой ссылке
        // payment.transactionId — сохраните, колбэк ссылается на него
        return payment;
    }
}
```

**3. Дальше:** покупатель платит → Platega присылает [колбэк](#колбэки) → вы зачисляете заказ.

## Конфигурация

| Параметр     | Обязательный | Описание                                                    |
| ------------ | ------------ | ----------------------------------------------------------- |
| `merchantId` | да           | `X-MerchantId` — идентификатор магазина из личного кабинета |
| `secret`     | да           | `X-Secret` — секретный API-ключ                             |
| `baseUrl`    | нет          | URL API, по умолчанию `https://app.platega.io`              |

Оба ключа выдаёт менеджер Platega при онбординге, также они доступны в кабинете на странице **«Настройки»**. Конфигурация валидируется при старте приложения: если ключа нет — упадёт сразу с понятной ошибкой, а не на первом запросе.

> ⚠️ **Никогда не коммитьте ключи в git.** Храните их в переменных окружения — любой, кто знает ваш `X-Secret`, может выполнять запросы от вашего имени.

### Синхронная — `forRoot()`

Подходит, когда ключи доступны на этапе загрузки модуля:

```typescript
PlategaNestjsModule.forRoot({
    merchantId: process.env.PLATEGA_MERCHANT_ID!,
    secret: process.env.PLATEGA_SECRET!,
});
```

### Асинхронная — `forRootAsync()`

Подходит, когда ключи приходят из `ConfigService` или другого провайдера:

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

## Что умеет SDK

Внедрённый экземпляр `Platega` даёт доступ ко всем модулям SDK:

| Что нужно сделать                            | Метод                                    |
| -------------------------------------------- | ---------------------------------------- |
| Платёж с конкретным методом (СБП, карта...)  | `platega.payments.create()`              |
| Платёжная ссылка (метод выбирает плательщик) | `platega.payments.createLink()`          |
| Статус платежа                               | `platega.payments.getById()`             |
| Балансы по всем валютам                      | `platega.balances.getAll()`              |
| История конверсий                            | `platega.conversions.list()`             |
| Можно ли отменить транзакцию                 | `platega.refunds.checkCancelSupported()` |
| Отмена транзакции (возврат)                  | `platega.refunds.cancel()`               |
| Выплата на карту RUB                         | `platega.withdrawals.createCardRub()`    |
| Сохранённые карты для выплат                 | `platega.withdrawals.getSavedCards()`    |
| Проверка подлинности колбэка                 | `platega.verifyCallback()`               |

Константы (`PAYMENT_METHOD`, `PAYMENT_STATUS`, `CALLBACK_STATUS`...), zod-схемы и все типы запросов/ответов экспортируются из корня `@tsforge7/platega-sdk` — глубокие импорты не нужны. Полное описание — в [документации SDK](https://github.com/tsforge/platega-sdk).

## Примеры

### Сервис

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPlatega } from '@tsforge7/platega-sdk-nestjs';
import { Platega, PAYMENT_METHOD } from '@tsforge7/platega-sdk';

@Injectable()
export class PaymentService {
    constructor(@InjectPlatega() private readonly platega: Platega) {}

    // Платёж через СБП (метод выбран заранее)
    public async createSbpPayment(amount: number, orderId: string, userId: string) {
        return this.platega.payments.create({
            paymentMethod: PAYMENT_METHOD.SBP,
            paymentDetails: { amount, currency: 'RUB' },
            description: `Заказ #${orderId}`,
            return: 'https://myshop.com/success',
            failedUrl: 'https://myshop.com/fail',
            payload: orderId,
            metadata: { userId }, // ID плательщика в вашей системе — нужен для антифрода
        });
    }

    // Проверка статуса
    public async getStatus(transactionId: string) {
        const tx = await this.platega.payments.getById(transactionId);
        return tx.status; // 'PENDING' | 'CONFIRMED' | 'CANCELED' | 'CHARGEBACKED'
    }
}
```

### CQRS-хендлер

Пример для проектов на `@nestjs/cqrs`. Тип ответа берётся прямо из SDK — `CreatePaymentLinkV2Command.ICreatePaymentLinkV2Response`:

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
                description: `Заказ #${uuid}`,
                return: 'https://myshop.com/success',
                failedUrl: 'https://myshop.com/fail',
                payload: uuid, // вернётся в колбэке
                metadata: { userId: userUuid },
            });

            return {
                isSuccess: true,
                data: payment, // payment.url, payment.transactionId
            };
        } catch (error: unknown) {
            // Невалидные параметры — SDK отклонил запрос ДО отправки (сумма, обязательные поля...)
            if (error instanceof ZodError) {
                this.logger.error(
                    `[CreatePaymentLinkHandler] Invalid payment params: ${JSON.stringify(error.issues)}`,
                );
                return {
                    isSuccess: false,
                    ...ERRORS.CREATE_PAYMENT_LINK_INVALID_PARAMS,
                };
            }

            // Ошибка API Platega: 'Platega API error <status>: <тело ответа>'
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

### Колбэки

Когда статус транзакции меняется, Platega шлёт **POST** на ваш URL (настраивается в кабинете: Настройки → Callback URLs). Колбэки не имеют криптографической подписи — вместо этого запрос несёт ваши `X-MerchantId` и `X-Secret`, которые SDK сверяет с конфигом timing-safe сравнением:

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
        // 1. Это точно Platega? (сверка заголовков)
        if (!this.platega.verifyCallback(req.headers)) {
            return res.status(HttpStatus.UNAUTHORIZED).end();
        }

        // 2. Парсим тело: { id, amount, currency, status, paymentMethod, payload? }
        const cb = TransactionCallbackCommand.TransactionCallbackSchema.parse(req.body);

        // 3. Не верим колбэку на слово — перепроверяем статус через API
        const tx = await this.platega.payments.getById(cb.id);

        if (tx.status === 'CONFIRMED') {
            // 4. Сверяем сумму/валюту с заказом и зачисляем (идемпотентно —
            //    Platega повторяет колбэк до 3 раз, заказ не должен зачислиться дважды)
        }

        // 5. Отвечаем 200, иначе Platega повторит запрос
        return res.status(HttpStatus.OK).end();
    }
}
```

Статусы в колбэке: `CONFIRMED` — оплачен, `CANCELED` — отклонён, `CHARGEBACKED` — возврат средств. `PENDING` в колбэках не приходит.

## Обработка ошибок

SDK бросает ошибки в двух случаях:

```typescript
import { ZodError } from 'zod';

try {
    await this.platega.payments.createLink({/* ... */});
} catch (error) {
    if (error instanceof ZodError) {
        // 1. Ошибка валидации ДО отправки запроса — невалидные параметры
        console.log(error.issues);
    } else if (error instanceof Error) {
        // 2. Ошибка API Platega — не-2xx ответ
        //    Формат: 'Platega API error <status>: <тело ответа>'
        console.log(error.message);
    }
}
```

| Статус API | Значение                            |
| ---------- | ----------------------------------- |
| 400        | Ошибка валидации на стороне Platega |
| 401        | Неверные `merchantId`/`secret`      |
| 404        | Транзакция не найдена               |

## API модуля

| Экспорт                                  | Описание                                                       |
| ---------------------------------------- | -------------------------------------------------------------- |
| `PlategaNestjsModule.forRoot(options)`   | Синхронная конфигурация                                        |
| `PlategaNestjsModule.forRootAsync(opts)` | Асинхронная конфигурация (`useFactory` / `imports` / `inject`) |
| `@InjectPlatega()`                       | Декоратор для внедрения экземпляра `Platega`                   |
| `IPlategaModuleOptions`                  | Тип опций модуля (`merchantId`, `secret`, `baseUrl?`)          |

Модуль помечен `@Global()` — подключается один раз в корневом модуле, после чего `@InjectPlatega()` работает в любом месте приложения без повторных импортов.

## Требования

- Node.js 18+ (SDK использует встроенный `fetch`)
- NestJS 10+
- TypeScript 5.0+

## Как внести изменения

**Нашли баг?** Создайте [Issue](https://github.com/tsforge/platega-sdk-nestjs/issues/new) — опишите, что делали, что ожидали и что получили (код ошибки, версии модуля, SDK и Node). Никогда не указывайте в issue свои `X-MerchantId`/`X-Secret` и данные реальных транзакций.

**Хотите предложить изменение?** Прямые пуши в репозиторий закрыты — изменения принимаются через Merge Request из форка:

1. **Сделайте форк** репозитория — кнопка «Fork» на странице [tsforge/platega-sdk-nestjs](https://github.com/tsforge/platega-sdk-nestjs).
2. **Склонируйте форк** и создайте ветку:

    ```bash
    git clone git@github.com:<ваш-логин>/platega-sdk-nestjs.git
    cd platega-sdk-nestjs
    npm install
    git checkout -b fix/my-fix
    ```

3. **Внесите изменения** и убедитесь, что всё зелёное:

    ```bash
    npm run lint      # линтер
    npm run build     # сборка
    npm run format    # prettier
    ```

    Комментарии в коде — на английском.

4. **Запушьте ветку в свой форк** и откройте Merge Request в `main` основного репозитория. Опишите, что и зачем изменили; если MR закрывает issue — сошлитесь на него (`Closes #N`).

## Лицензия

ISC © [tsforge](https://github.com/tsforge)
