FROM debian:stable

RUN apt-get update \
  && apt-get install -y wget

RUN apt-get update && apt-get install -y gnupg

RUN echo "deb http://download.proxmox.com/debian/pve bullseye pve-no-subscription" | tee /etc/apt/sources.list.d/pve-install-repo.list

#RUN wget http://download.proxmox.com/debian/proxmox-release-bullseye.gpg
RUN wget http://download.proxmox.com/debian/proxmox-ve-release-6.x.gpg
RUN apt-key add proxmox-ve-release-6.x.gpg

RUN echo "deb http://download.proxmox.com/debian/pve buster pve-no-subscription" > /etc/apt/sources.list.d/pve-no-subscription.list

RUN apt update
RUN apt install proxmox-ve postfix open-iscsi

# RUN apt remove os-prober

#RUN mv proxmox-release-bullseye.gpg /etc/apt/trusted.gpg.d/proxmox-release-bullseye.gpg

#RUN chmod +r /etc/apt/trusted.gpg.d/proxmox-release-bullseye.gpg

#RUN apt update

#RUN apt full-upgrade -y

#RUN apt update

#RUN echo "deb http://download.proxmox.com/debian/ceph-pacific bullseye main" | tee /etc/apt/sources.list.d/ceph.list

# RUN apt-get install -y proxmox-ve postfix open-iscsi

#RUN apt update
