import { Schema } from "koishi"

export interface Config {
        path: string
}

export const Config: Schema<Config> = Schema.object({
        path: Schema.string()
                .default('/msgluna')
                .description('监听路径')
})
