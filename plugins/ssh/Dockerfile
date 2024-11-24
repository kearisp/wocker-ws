# Використовуйте базовий образ, наприклад, Ubuntu
FROM ubuntu:20.04

# Оновлення та установка пакету OpenSSH Server
RUN apt-get update && \
   apt-get install -y openssh-server && \
   mkdir /var/run/sshd

# Додайте користувача з паролем
RUN echo 'root:root_password' | chpasswd

# Дозвольте підключення з паролем
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Відкрийте порт 22
EXPOSE 22

# Запустіть сервіс SSH
CMD ["/usr/sbin/sshd", "-D"]
