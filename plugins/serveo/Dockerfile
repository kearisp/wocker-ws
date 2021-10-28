FROM ubuntu:latest

ARG USER=user

RUN apt-get update && apt-get install -y autossh
RUN useradd -m -d /home/$USER -s /bin/bash $USER
RUN mkdir -p /home/$USER/.ssh
RUN chown -R $USER:$USER /home/$USER

USER $USER

RUN ssh-keygen -q -t rsa -N '' -f /home/$USER/.ssh/id_rsa

RUN chmod 700 /home/$USER/.ssh
RUN chmod 600 /home/$USER/.ssh/*

CMD ["/bin/bash"]