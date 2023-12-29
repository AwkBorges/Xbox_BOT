const { Client, GatewayIntentBits, ActionRowBuilder, Events, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const Discord = require("discord.js");
require('dotenv').config()
const fs = require('fs');
const uuid = require('uuid');
const qrcode = require('qrcode');
const { AttachmentBuilder } = require('discord.js');

const client = new Discord.Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

module.exports = client

client.on('interactionCreate', (interaction) => {

  if (interaction.type === Discord.InteractionType.ApplicationCommand) {

    const cmd = client.slashCommands.get(interaction.commandName);

    if (!cmd) return interaction.reply(Error);

    interaction["member"] = interaction.guild.members.cache.get(interaction.user.id);

    cmd.run(client, interaction)

  }
})

client.slashCommands = new Discord.Collection()
require('./handler')(client)
client.login(process.env.TOKEN)

async function verificarPagamentosAprovados(pagamentos) {
  const pagamentosAprovados = [];

  for (const pagamento of pagamentos) {
    try {
      const response = await axios.get(`https://api.mercadopago.com/v1/payments/${pagamento.mp_id}`, {
        headers: {
          Authorization: `Bearer ${process.env.MPTOKEN}`,
        },
      });

      if (response.data.status === 'approved') {
        pagamentosAprovados.push(pagamento.mp_id);
      }
    } catch (error) {
      console.error(`Erro ao verificar pagamento ${pagamento.mp_id}:`, error.message);
    }
  }

  return pagamentosAprovados;
}

function lerPagamentosAtivos() {
  const jsonPagAtivosData = fs.readFileSync('./databases/pagAtivos.json', 'utf8');
  return JSON.parse(jsonPagAtivosData);
}

async function main() {
  setInterval(async () => {
    const pagamentosAtivos = lerPagamentosAtivos();
    const pagamentosAprovados = await verificarPagamentosAprovados(pagamentosAtivos);

    const jsonPagAtivosData = fs.readFileSync('./databases/pagAtivos.json', 'utf8');
    const pagAtivos = JSON.parse(jsonPagAtivosData);

    for (const mp_id of pagamentosAprovados) {
      const pagamentoAprovado = pagAtivos.find((pagamento) => pagamento.mp_id === mp_id);

      if (pagamentoAprovado) {
        const { user_id, ...rest } = pagamentoAprovado;

        const dadosConta = pagAtivos.find((pagamento) => pagamento.user_id === user_id);

        if (dadosConta) {
          const user = await client.users.fetch(user_id);
          const embed = new Discord.EmbedBuilder()
            .setColor(0xA2FF00)
            .setDescription(`**Key:** ${dadosConta.key}\n Resgate em: https://account.microsoft.com/billing/redeem?refd=account.microsoft.com`)
            .setFooter({ text: `Obrigado por comprar com a ${process.env.NAME}! 💛` })
          try {

            await user.send({ embeds: [embed] });

            const channel = client.channels.cache.get(dadosConta.channel_id);
            channel.send('Compra aprovada, iremos enviar sua conta na DM e excluir esse canal em 5 segundos!')

            const embedLog = new Discord.EmbedBuilder()
              .setColor(0x00E4FF)
              .setTitle(`Venda Realizada`)
              .setDescription(`**Compra:** ${dadosConta.uuid}\n**User:** ${user_id}\n **Key:** ${dadosConta.key}`)

            const channelLOG = client.channels.cache.get(process.env.LOGCARRINHOS)
            channelLOG.send({ embeds: [embedLog] })

            const guild = await client.guilds.fetch(process.env.GUILD);
            const member = await guild.members.fetch(user_id);
            const role = guild.roles.cache.get(process.env.CLIENTE);

            if (member && role) {
              await member.roles.add(role);
            }

            fs.appendFile(
              './databases/vendas.txt',
              `${dadosConta.uuid};${dadosConta.user_id};${dadosConta.data_compra};${dadosConta.key};\n`,
              (error) => {
                if (error) {
                  console.error(error);
                }
              }
            );

            setTimeout(() => {
              channel.delete()
            }, 5000);


          } catch (error) {
            const channel = client.channels.cache.get(dadosConta.channel_id);
            console.error('Erro ao enviar mensagem para a DM do usuário:', error);
            channel.send('Sua DM está fechada então mandaremos a mensagem por aqui, por favor, salve sua conta pois o canal será fechado em breve!')
            channel.send({ embeds: [embed] });

            const embedLog = new Discord.EmbedBuilder()
              .setColor(0x00E4FF)
              .setTitle(`Venda Realizada`)
              .setDescription(`**Compra:** ${dadosConta.uuid}\n**User:** ${user_id}\n **Key:** ${dadosConta.key}`)

            const channelLOG = client.channels.cache.get(process.env.LOGCARRINHOS)
            channelLOG.send({ embeds: [embedLog] })
            
            const guild = await client.guilds.fetch(process.env.GUILD);
            const member = await guild.members.fetch(user_id);
            const role = guild.roles.cache.get(process.env.CLIENTE);

            if (member && role) {
              await member.roles.add(role);
            }


            fs.appendFile(
              './databases/vendas.txt',
              `${dadosConta.uuid};${dadosConta.user_id};${dadosConta.data_compra};${dadosConta.key};\n`,
              (error) => {
                if (error) {
                  console.error(error);
                }
              }
            );

          }
        }

        const novoPagAtivos = pagAtivos.filter((pagamento) => pagamento.mp_id !== mp_id);
        fs.writeFileSync('./databases/pagAtivos.json', JSON.stringify(novoPagAtivos, null, 2));
      }
    }

  }, 5000);
}


client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
  main().catch((error) => {
    console.error('Ocorreu um erro:', error);
  });
})


client.on("interactionCreate", (interaction) => {

  if (interaction.isButton()) {
    if (interaction.customId === "close") {

      const userID = interaction.user.id

      const jsonPagAtivosData = fs.readFileSync('./databases/pagAtivos.json', 'utf8');
      const originalData = JSON.parse(jsonPagAtivosData);

      const removedObject = originalData.find(obj => obj.user_id === userID);

      if (removedObject) {

        const { mp_id, user_id, user_email, uuid, data_compra, cupom, pix, channel_id, valorAtualizado, ...newObject } = removedObject;

        const updatedData = originalData.filter(obj => obj.user_id !== userID);

        const jsonEstoqueData = fs.readFileSync('./databases/estoque.json', 'utf8');
        const estoqueData = JSON.parse(jsonEstoqueData);
        estoqueData.push(newObject);

        fs.writeFileSync('./databases/pagAtivos.json', JSON.stringify(updatedData, null, 2));

        fs.writeFileSync('./databases/estoque.json', JSON.stringify(estoqueData, null, 2));

        const embedLog = new Discord.EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`Compra cancelada`)
          .setDescription(`**Compra:** ${uuid}\n**User:** ${interaction.user.username}\n**UserID:** ${userID}\n **Key:** ${newObject.key}\n`)

        const channelLOG = interaction.guild.channels.cache.get(process.env.LOGCARRINHOS)
        channelLOG.send({ embeds: [embedLog] })

      } else {


      }

      interaction.reply('Compra cancelada, o canal fechará em 3 segundos!')

      setTimeout(() => {
        try {
          interaction.channel.delete()
        } catch (e) {
          return;
        }
      }, 3000)

    }

    if (interaction.customId === "pix") {


      const pagAtivosData = fs.readFileSync('./databases/pagAtivos.json');
      const pagAtivos = JSON.parse(pagAtivosData);

      const userID = interaction.user.id;
      const usuarioEncontrado = pagAtivos.find((pagAtivo) => pagAtivo.user_id === userID);

      if (usuarioEncontrado) {


        const pix = usuarioEncontrado.pix;
        interaction.reply(pix)


      } else {


      }

    }

    if (interaction.customId === "comprar_xbox") {

      const modal = new ModalBuilder()
        .setCustomId('xboxModal')
        .setTitle('Compra de Xbox');

      const emailInput = new TextInputBuilder()
        .setCustomId('emailInput')
        .setLabel("Digite um email")
        .setStyle(TextInputStyle.Short);

      const cupomInput = new TextInputBuilder()
        .setCustomId('cupomInput')
        .setLabel("Possui um cupom?")
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const firstActionRow = new ActionRowBuilder().addComponents(emailInput);
      const secondActionRow = new ActionRowBuilder().addComponents(cupomInput);

      modal.addComponents(firstActionRow, secondActionRow)

      interaction.showModal(modal);
    }

    if(interaction.customId === "estoque_xbox"){

      fs.readFile('./databases/estoque.json', 'utf8', (err, data) => {
        if (err) {
          console.error('Erro ao ler o arquivo:', err);
          return;
        }

        try {

          const jsonObject = JSON.parse(data);

          if (Array.isArray(jsonObject)) {
            const quantidadeDeObjetos = jsonObject.length;
            interaction.reply({ content: `Nosso estoque de Keys é de {**${quantidadeDeObjetos}**}`, ephemeral: true })
          } else {
            console.log('O JSON não contém um array de objetos.');
          }
        } catch (parseError) {
          console.error('Erro ao analisar o JSON:', parseError);
        }
      });

    }

  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'xboxModal') {

      const user_email = interaction.fields.getTextInputValue('emailInput');
      const cupom = interaction.fields.getTextInputValue('cupomInput');
      const cupons = fs.readFileSync('./databases/cupons.txt', 'utf8').split('\n');

      async function processXboxPurchase() {

        function readEstoque(filePath) {
          return new Promise((resolve, reject) => {
            fs.readFile(filePath, 'utf8', (err, data) => {
              if (err) {
                reject(err);
                return;
              }

              const jsonData = JSON.parse(data);
              resolve(jsonData);
            });
          });
        }

        const estoqueData = await readEstoque('./databases/estoque.json')
        const currentDate = new Date();

        const firstAccount = estoqueData[0];

        const modifiedFirstAccount = {
          uuid: uuid.v4(),
          data_compra: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`,
          user_id: interaction.user.id,
          user_email: user_email,
          ...firstAccount
        };

        const channel_name = `🪖﹒xboxkey﹒${interaction.user.username}`;
        const text_category_id = process.env.CARRINHO

        if (!interaction.guild.channels.cache.get(text_category_id)) text_category_id = null;

        if (interaction.guild.channels.cache.find(c => c.name === channel_name)) {
          interaction.reply({ content: ` Você já possui uma compra aberta em ${interaction.guild.channels.cache.find(c => c.name === channel_name)}, por favor, realize uma compra de cada vez!`, ephemeral: true })
        } else {

          const index = 0;
          if (index !== -1 && index < estoqueData.length) {

            const removedAccount = estoqueData.splice(index, 1)[0];
            fs.writeFileSync('./databases/estoque.json', JSON.stringify(estoqueData, null, 2));

          } else {

            interaction.reply({ content: `Atualmente estamos sem contas no estoque`, ephemeral: true });
            return;

          }

          const valor = 0.10
          const transactionAmount = cupom !== null && cupons.includes(cupom) ? parseFloat((valor - valor * 0.1).toFixed(2)) : valor;

          const buyerName = 'Nome do comprador';
          const buyerEmail = 'email@example.com';
          const buyerCPF = '47161952441';

          const accessToken = process.env.MPTOKEN

          const apiUrl = 'https://api.mercadopago.com/v1/payments';

          const paymentData = {
            transaction_amount: Number(transactionAmount),
            description: `Xbox Key`,
            payment_method_id: 'pix',
            payer: {
              email: buyerEmail,
              identification: {
                type: 'CPF',
                number: buyerCPF
              },
              first_name: buyerName
            }
          };

          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          };

          fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(paymentData)
          })
            .then(response => response.json())
            .then(data => {

              const paymentID = data.id
              const pixKey = data.point_of_interaction.transaction_data.qr_code;
              const ticketUrl = data.point_of_interaction.transaction_data.ticket_url;

              async function generateQRCode(pixKey) {
                try {
                  const qrCodeDataUrl = await qrcode.toDataURL(pixKey);
                  const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
                  const qrCodeBuffer = Buffer.from(base64Data, 'base64');

                  fs.writeFileSync('./databases/qrcode.png', qrCodeBuffer);

                } catch (err) {
                  console.error('Erro ao gerar o QR code:', err);
                }
              }

              generateQRCode(pixKey)
              const file = new AttachmentBuilder('./databases/qrcode.png');
              const { user_id, uuid, data_compra, key} = modifiedFirstAccount;
              const pagAtivosData = JSON.parse(fs.readFileSync('./databases/pagAtivos.json', 'utf8'));

              const valorAtualizado = Number(transactionAmount)

              interaction.guild.channels.create({
                name: channel_name,
                type: Discord.ChannelType.GuildText,
                parent: text_category_id,
                permissionOverwrites: [
                  {
                    id: interaction.guild.id,
                    deny: [
                      Discord.PermissionFlagsBits.ViewChannel
                    ]
                  },
                  {
                    id: interaction.user.id,
                    allow: [
                      Discord.PermissionFlagsBits.ViewChannel,
                      Discord.PermissionFlagsBits.SendMessages,
                      Discord.PermissionFlagsBits.AttachFiles,
                      Discord.PermissionFlagsBits.EmbedLinks,
                      Discord.PermissionFlagsBits.AddReactions
                    ]
                  }
                ]
              }).then((ch) => {

                const channelID = ch.id;

                pagAtivosData.push({

                  mp_id: paymentID,
                  user_id: user_id,
                  user_email: user_email,
                  uuid: uuid,
                  data_compra: data_compra,
                  cupom: cupom,
                  pix: pixKey,
                  channel_id: channelID,
                  key: key,
                  valorAtualizado: valorAtualizado,

                });


                fs.writeFileSync('./databases/pagAtivos.json', JSON.stringify(pagAtivosData, null, 2));

                const embed = new Discord.EmbedBuilder()
                  .setColor(0x00A62E)
                  .setTitle(`ID: ${uuid}`)
                  .setDescription(`Realize o pagamento através do QRCode ou PIX copia e cola para receber sua conta automáticamente!\n
                🔒 Cancelar Compra\n
                💵 Código PIX copia e cola\n
                `)
                  .setThumbnail('attachment://qrcode.png');
                const button = new Discord.ActionRowBuilder().addComponents(
                  new Discord.ButtonBuilder()
                    .setCustomId("close")
                    .setEmoji("🔒")
                    .setStyle(Discord.ButtonStyle.Primary),
                  new Discord.ButtonBuilder()
                    .setCustomId("pix")
                    .setEmoji("💵")
                    .setStyle(Discord.ButtonStyle.Primary),
                  new Discord.ButtonBuilder()
                    .setLabel('PIX Ticket')
                    .setURL(`${ticketUrl}`)
                    .setStyle(Discord.ButtonStyle.Link),
                );

                ch.send({ embeds: [embed], components: [button], files: [file] })
                interaction.reply({ content: `Sua compra foi aberta no canal: ${ch}`, ephemeral: true })

              })

              const embedLog = new Discord.EmbedBuilder()
                .setColor(0xA2FF00)
                .setTitle(`Compra aberta`)
                .setDescription(`**Compra:** ${uuid}\n**User:** ${interaction.user.username}\n **UserID:** ${interaction.user.id}\n**Key:** ${key}`)

              const channelLOG = interaction.guild.channels.cache.get(process.env.LOGCARRINHOS)
              channelLOG.send({ embeds: [embedLog] })

            })
            .catch(error => {
              interaction.reply({ content: `Erro ao criar sua compra, por favor abra um ticket de suporte.`, ephemeral: true })
              console.error('Erro ao criar a preferência de pagamento:', error);
            });



        }

      }

      processXboxPurchase()

    }
  }

})

