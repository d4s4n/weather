const https = require('https');

const COMMAND_NAME = 'weather';
const PERMISSION_NAME = 'user.weather';
const PLUGIN_OWNER_ID = 'plugin:weather-command';

async function onLoad(bot, options) {
    const log = bot.sendLog;
    const Command = bot.api.Command;
    const settings = options.settings;

    class WeatherCommand extends Command {
        constructor() {
            super({
                name: COMMAND_NAME,
                description: 'Показывает погоду в указанном городе.',
                aliases: ['погода'],
                permissions: PERMISSION_NAME,
                owner: PLUGIN_OWNER_ID,
                cooldown: 10,
                allowedChatTypes: ['chat', 'private', 'clan'],
                args: [{
                    name: 'city',
                    type: 'string',
                    required: true,
                    description: 'Название города'
                }]
            });
        }

        async handler(bot, typeChat, user, {
            city
        }) {
            try {
                const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`;
                const agent = new https.Agent({
                    family: 4
                });

                const geoResponse = await fetch(geocodingUrl, {
                    agent
                });
                if (!geoResponse.ok) throw new Error(`Geo API Error: ${geoResponse.status}`);
                const geoData = await geoResponse.json();

                if (!geoData.results || geoData.results.length === 0) {
                    const notFoundMsg = settings.notFoundMessage.replace('{city}', city);
                    bot.api.sendMessage(typeChat, notFoundMsg, user.username);
                    return;
                }

                const {
                    latitude,
                    longitude,
                    name: foundCityName
                } = geoData.results[0];
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m&lang=ru`;

                const weatherResponse = await fetch(weatherUrl, {
                    agent
                });
                if (!weatherResponse.ok) throw new Error(`Weather API Error: ${weatherResponse.status}`);
                const weatherData = await weatherResponse.json();

                const weatherCodes = {
                    0: 'ясно',
                    1: 'преимущественно ясно',
                    2: 'переменная облачность',
                    3: 'пасмурно',
                    45: 'туман',
                    48: 'густой туман',
                    51: 'легкая морось',
                    53: 'морось',
                    55: 'сильная морось',
                    61: 'небольшой дождь',
                    63: 'дождь',
                    65: 'сильный дождь',
                    71: 'небольшой снег',
                    73: 'снег',
                    75: 'сильный снег',
                    80: 'небольшой ливень',
                    81: 'ливень',
                    82: 'сильный ливень',
                    95: 'гроза',
                    96: 'гроза с градом'
                };

                const description = weatherCodes[weatherData.current.weather_code] || 'неизвестно';

                const infoMessage = settings.infoMessage
                    .replace('{city}', foundCityName)
                    .replace('{temp}', Math.round(weatherData.current.temperature_2m))
                    .replace('{description}', description)
                    .replace('{windSpeed}', weatherData.current.wind_speed_10m.toFixed(1))
                    .replace('{windGust}', weatherData.current.wind_gusts_10m.toFixed(1));

                bot.api.sendMessage(typeChat, infoMessage, user.username);

            } catch (error) {
                log(`[${PLUGIN_OWNER_ID}] Ошибка API для города '${city}': ${error.message}`);
                bot.api.sendMessage(typeChat, 'Произошла ошибка при получении данных о погоде. Попробуйте позже.', user.username);
            }
        }
    }

    try {
        await bot.api.registerCommand(new WeatherCommand());
        log(`[${PLUGIN_OWNER_ID}] Команда '${COMMAND_NAME}' успешно зарегистрирована.`);
    } catch (error) {
        log(`[${PLUGIN_OWNER_ID}] Ошибка при регистрации команды: ${error.message}`);
    }
}

async function onUnload({
    botId,
    prisma
}) {
    console.log(`[${PLUGIN_OWNER_ID}] Начало удаления ресурсов для бота ID: ${botId}`);
    try {
        await prisma.command.deleteMany({
            where: {
                botId,
                owner: PLUGIN_OWNER_ID
            }
        });
        await prisma.permission.deleteMany({
            where: {
                botId,
                owner: PLUGIN_OWNER_ID
            }
        });
        console.log(`[${PLUGIN_OWNER_ID}] Ресурсы для бота ID: ${botId} успешно удалены.`);
    } catch (error) {
        console.error(`[${PLUGIN_OWNER_ID}] Ошибка при очистке ресурсов:`, error);
    }
}

module.exports = {
    onLoad,
    onUnload,
};
