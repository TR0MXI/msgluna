import { randomBytes } from 'node:crypto'
import { Bot, Context } from 'koishi'
import {} from '@koishijs/plugin-server'
import { MsgLuna } from './types'
import { Config } from './config'

export const name = 'msgluna'
export * from './types'
export * from './config'
export const inject = {
        required: ['database', 'server']
}

declare module 'koishi' {
        interface Tables {
                msgluna: MsgLuna
        }
}

export function apply(ctx: Context, config: Config) {
        const logger = ctx.logger('msgluna')
        const path = config.path + '/:sendkey'

        if (!ctx.database) {
                logger.error('ctx.database is null')
                return
        }

        if (!ctx.server) {
                logger.error('ctx.server is null')
                return
        }
        
        ctx.model.extend('msgluna', {
                userid: 'unsigned',
                authtoken: 'string',
                assignee: 'string'
        },{
                primary: 'authtoken',
                autoInc: false,
                unique: ['userid'],
                foreign: {
                        userid: ['user', 'id'],
                }
        })

        const send = async (
                title: string | string[],
                desp: string | string[],
                text: string | string[],
                tags: string | string[],
                short: string | string[],
                sendkey: string
        ) => {
                if (sendkey.endsWith('.send')) {
                        sendkey = sendkey.slice(0, -5);
                }
        
                const decodedTitle = decodeAndDefault(title)
                const decodedDesp = decodeAndDefault(desp)
                const decodedText = decodeAndDefault(text)
                const decodedTags = decodeAndDefault(tags)
                const decodedShort = decodeAndDefault(short)

                const { userid, assignee } = (await ctx.database.get('msgluna', { authtoken: sendkey }))[0]
                const { pid, platform } = (await ctx.database.get('binding', { aid: userid}))[0]
                const bot = ctx.bots.find(bot => bot.platform === platform && bot.selfId === assignee)

                const isOk = userid && assignee && pid && platform

                if (!isOk) logger.info(sendkey + '可能失效')
        
                const content = createMsg(
                        decodedTitle,
                        decodedDesp,
                        decodedText,
                        decodedTags,
                        decodedShort
                )
                bot.sendPrivateMessage(pid, content)
        }

        ctx.server['get'](path, async (kctx) => {
                const { title, desp, text, tags, short } = kctx.query
                let { sendkey } = kctx.params

                send(title, desp, text, tags, short, sendkey)
        })

        ctx.server['post'](path, async (kctx) => {
                const { title, desp, text, tags, short } = kctx.request.body
                let { sendkey } = kctx.params

                send(title, desp, text, tags, short, sendkey)
        })

        ctx.command('msgluna.key', 'msgluna', { authority: 3 })
                .action(async ({session}) => {
                        const userid = (await ctx.database.getUser(session.platform,session.userId)).id
                        const assignee = session.selfId
                        const bot = ctx.bots.find(bot => bot.platform === session.platform && bot.selfId === assignee)
                        if (!userid) return 'User未注册'

                        const data = await ctx.database.get('msgluna', {userid})
                        if (data.length > 0) {
                                bot.sendPrivateMessage(session.userId, `密钥已存在：${data[0].authtoken}`)
                                return '密钥已存在, 请在私聊查看'
                        }

                        const authtoken = randomBytes(32).toString('hex')

                        await ctx.database.create('msgluna', {userid, authtoken, assignee})
                        logger.info(`${session.userId} 生成密钥：${authtoken}`)

                        bot.sendPrivateMessage(session.userId, `请妥善保管密钥: ${authtoken}`)
                        return '密钥已生成, 请在私聊查看'
                })

        ctx.command('msgluna.dkey', 'msgluna', { authority: 3 })
                .action(async ({session}) => {
                        const userid = (await ctx.database.getUser(session.platform,session.userId)).id
                        if (!userid) return 'User未注册'

                        const data = await ctx.database.get('msgluna', {userid})
                        if (data.length == 0) return '密钥不存在'

                        await ctx.database.remove('msgluna', {userid})
                        logger.info(`${session.userId}密钥已删除`)
                        return '密钥已删除'
                })
}

function decodeAndDefault(value: string | string[]): string {
        const decodedValue = decodeURIComponent(Array.isArray(value) ? value[0] : value)
        return decodedValue === 'undefined' ? '' : decodedValue
}

function createMsg(...msgs: string[]): string {
        let reMsg: string = ''
        for (const msg of msgs) {
                reMsg += (msg + '\n')
        }

        return reMsg
}