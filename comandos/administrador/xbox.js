const Discord = require("discord.js")

module.exports = {
  name: "xboxkey",
  description: "Painel de vendas Handlevel",
  type: Discord.ApplicationCommandType.ChatInput,

  run: async (client, interaction) => {

    if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageGuild)) {
        interaction.reply({ content: `Você não possui permissão para utilzar este comando!`, ephemeral: true })
    } else {
        let embed = new Discord.EmbedBuilder()
        .setTitle("<:Xbox:1168904062369018037> Gamepass Key")
        .setColor(0xA2FF00)
        .setDescription("✅ Produto via key\n✅ Entrega automática\n✅ PC Game Pass 1 mês\n✅Sem riscos de queda \n✅ Funciona em qualquer conta\n✅ Necessário vincular cartão\n✅ Tenha acesso completo ao pc game pass\n\n_Após a compra, você receberá uma chave para ativar em sua conta Microsoft._")
        .setImage('https://media.discordapp.net/attachments/1118926666534752256/1169001720559439973/PC-Game-Pass.png?ex=6553d0b1&is=65415bb1&hm=22e39c88426c2a6059bd1fe5aa3f283e00a6c555d66e0121079e4271b20cce44&=&width=1654&height=930')
        
        const button = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
            .setCustomId("comprar_xbox")
            .setLabel("R$ 10,00 - Comprar")
            .setStyle(Discord.ButtonStyle.Primary),
            new Discord.ButtonBuilder()
            .setCustomId("estoque_xbox")
            .setEmoji("💾")
            .setStyle(Discord.ButtonStyle.Primary),
        );

        interaction.reply({ content: `✅ Mensagem enviada!`, ephemeral: true })
        interaction.channel.send({ embeds: [embed], components: [button] })
    }


  },
}
